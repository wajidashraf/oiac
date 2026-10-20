using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;
using System.ServiceModel;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.6.2")]
namespace Oiac.Engage.CoverageFiles
{
    public sealed class CoverageFileCommandPlugin : IPlugin
    {
        const string Table = "mss_presscoverage", FileField = "mss_coveragefile", NameField = "mss_coveragefile_name", StateField = "mss_coverageuploadstate";
        const int ChunkSize = 262144, MaxSize = 10485760;
        static readonly Guid AdminRole = new Guid("6ec72c3e-4f1b-420f-9565-d20047b12c1f"), Site = new Guid("e7f400bd-1e04-4efa-b8b3-7a7a3b168662");
        static readonly string[] Fields =
        {
            "mss_submittedby",
            "mss_isfeatured",
            FileField,
            NameField,
            StateField,
            "versionnumber"
        };
        sealed class Problem : Exception
        {
            public readonly string Code;
            public Problem(string code)
            {
                Code = code;
            }
        }

        static void Fail(string code)
        {
            throw new Problem(code);
        }

        // Private server storage. No state object is returned through the public DTO.
        [DataContract]
        public sealed class State
        {
            [DataMember]
            public string Coverage;
            [DataMember]
            public string Actor;
            [DataMember]
            public string Session;
            [DataMember]
            public string Variant;
            [DataMember]
            public string Name;
            [DataMember]
            public string Mime;
            [DataMember]
            public int Size;
            [DataMember]
            public string Token;
            [DataMember]
            public List<string> Hashes = new List<string>();
            [DataMember]
            public string Phase;
            [DataMember]
            public string Nonce;
            [DataMember]
            public long Lease;
            [DataMember]
            public long Expires;
        }

        public void Execute(IServiceProvider provider)
        {
            var c = (IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
            if (c.MessageName != "mss_CoverageFileCommand")
                throw new InvalidPluginExecutionException("Unsupported command.");
            object a, cmd, p;
            c.InputParameters.TryGetValue("ActorContactId", out a);
            c.InputParameters.TryGetValue("Command", out cmd);
            c.InputParameters.TryGetValue("Payload", out p);
            var f = (IOrganizationServiceFactory)provider.GetService(typeof(IOrganizationServiceFactory));
            c.OutputParameters["Result"] = Run(f.CreateOrganizationService(c.UserId), a is Guid ? (Guid)a : Guid.Empty, cmd as string, p as string);
        }

        public static string Run(IOrganizationService service, Guid actor, string command, string payload)
        {
            try
            {
                if (actor == Guid.Empty)
                    Fail("unauthenticated");
                if (!Eligible(service, actor))
                    Fail("forbidden");
                var p = Parse(payload);
                Guid id = Id(p, "id");
                var row = Load(service, id);
                if (command == "info")
                {
                    Keys(p, "id");
                    return Json(Info(service, row));
                }

                if (command == "read")
                {
                    Keys(p, "id", "fileId", "offset", "length");
                    return Json(Read(service, row, p));
                }

                if (command != "begin" && command != "chunk" && command != "commit")
                    Fail("validation");
                var creator = row.GetAttributeValue<EntityReference>("mss_submittedby");
                if ((creator == null || creator.Id != actor) && !IsAdmin(service, actor))
                    Fail("forbidden");
                if (command == "begin")
                    return Json(Begin(service, row, actor, p));
                return Json(command == "chunk" ? Chunk(service, row, actor, p) : Commit(service, row, actor, p));
            }
            catch (Problem e)
            {
                return Error(e.Code);
            }
            // No cleanup/retrieve/retry SDK call is safe after a caught native fault.
            catch (FaultException<OrganizationServiceFault> e)
            {
                return Error(e.Detail.ErrorCode == -2147088254 ? "conflict" : e.Detail.ErrorCode == -2147220969 ? "not_found" : "unavailable");
            }
            catch
            {
                return Error("unavailable");
            }
        }

        static string Error(string code)
        {
            return Json(D("ok", false, "error", D("code", code, "message", code == "validation" ? "Check the file and try again." : code == "conflict" ? "The file transfer changed. Restart the upload." : code == "forbidden" ? "You do not have permission to access this file." : code == "unauthenticated" ? "Sign in to continue." : code == "not_found" ? "The coverage or file is no longer available." : "File transfer is temporarily unavailable.")));
        }

        static bool Eligible(IOrganizationService s, Guid actor)
        {
            var c = s.Retrieve("contact", actor, new ColumnSet("statecode", "adx_identity_logonenabled", "adx_identity_username"));
            var state = c.GetAttributeValue<OptionSetValue>("statecode");
            if (state == null || state.Value != 0 || !c.GetAttributeValue<bool>("adx_identity_logonenabled"))
                return false;
            if (!string.IsNullOrWhiteSpace(c.GetAttributeValue<string>("adx_identity_username")))
                return true;
            var q = new QueryExpression("adx_externalidentity")
            {
                ColumnSet = new ColumnSet(false),
                TopCount = 1
            };
            q.Criteria.AddCondition("adx_contactid", ConditionOperator.Equal, actor);
            return s.RetrieveMultiple(q).Entities.Count > 0;
        }

        static bool IsAdmin(IOrganizationService s, Guid actor)
        {
            var q = new QueryExpression("contact")
            {
                ColumnSet = new ColumnSet(false),
                TopCount = 1
            };
            q.Criteria.AddCondition("contactid", ConditionOperator.Equal, actor);
            var link = q.AddLink("powerpagecomponent_mspp_webrole_contact", "contactid", "contactid").AddLink("powerpagecomponent", "powerpagecomponentid", "powerpagecomponentid");
            link.LinkCriteria.AddCondition("powerpagecomponentid", ConditionOperator.Equal, AdminRole);
            link.LinkCriteria.AddCondition("powerpagesiteid", ConditionOperator.Equal, Site);
            return s.RetrieveMultiple(q).Entities.Count > 0;
        }

        static Entity Load(IOrganizationService s, Guid id)
        {
            return s.Retrieve(Table, id, new ColumnSet(Fields));
        }

        static long Now()
        {
            return DateTime.UtcNow.Ticks;
        }

        static bool Featured(Entity row)
        {
            return row.GetAttributeValue<bool>("mss_isfeatured");
        }

        static State Stored(Entity row)
        {
            string raw = row.GetAttributeValue<string>(StateField);
            if (string.IsNullOrEmpty(raw))
                return null;
            if (raw.Length > 16000)
                Fail("unavailable");
            State state;
            try
            {
                using (var m = new MemoryStream(Encoding.UTF8.GetBytes(raw)))
                    state = (State)new DataContractJsonSerializer(typeof(State)).ReadObject(m);
            }
            catch
            {
                Fail("unavailable");
                return null;
            }

            Guid a, b, c;
            if (state == null ||
                !Guid.TryParseExact(state.Coverage, "D", out a) || a != row.Id ||
                !Guid.TryParseExact(state.Actor, "D", out b) || b == Guid.Empty ||
                !Guid.TryParseExact(state.Session, "D", out c) || c == Guid.Empty ||
                state.Hashes == null || state.Hashes.Count > 40 ||
                state.Hashes.Any(h => h == null || !Regex.IsMatch(h, "^[a-f0-9]{64}$")) ||
                state.Size < 1 || state.Size > (Featured(row) ? 2097152 : MaxSize) ||
                state.Hashes.Count > (state.Size + ChunkSize - 1) / ChunkSize ||
                !ValidName(state.Name, state.Mime, Featured(row)) ||
                state.Phase != "idle" && state.Phase != "busy" && state.Phase != "committing")
                Fail("unavailable");
            if (state.Variant != (Featured(row) ? "featured" : "press"))
                Fail("conflict");
            return state;
        }

        static string Serialize(State state)
        {
            if (state == null)
                return null;
            using (var m = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(State)).WriteObject(m, state);
                string result = Encoding.UTF8.GetString(m.ToArray());
                if (result.Length > 16000)
                    Fail("unavailable");
                return result;
            }
        }

        static Entity Save(IOrganizationService s, Entity row, State state)
        {
            if (string.IsNullOrEmpty(row.RowVersion))
                Fail("unavailable");
            var update = new Entity(Table, row.Id)
            {
                RowVersion = row.RowVersion
            };
            update[StateField] = Serialize(state);
            s.Execute(new UpdateRequest { Target = update, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            return Load(s, row.Id);
        }

        static Entity Claim(IOrganizationService s, Entity row, State state, string phase)
        {
            state.Phase = phase;
            state.Nonce = Guid.NewGuid().ToString("D");
            state.Lease = DateTime.UtcNow.AddMinutes(3).Ticks;
            state.Expires = DateTime.UtcNow.AddMinutes(15).Ticks;
            var saved = Save(s, row, state);
            OwnClaim(saved, state);
            return saved;
        }

        static void OwnClaim(Entity row, State state)
        {
            var current = Stored(row);
            if (current == null || current.Nonce != state.Nonce || current.Actor != state.Actor || current.Session != state.Session || current.Phase != state.Phase || current.Lease <= Now())
                Fail("conflict");
        }

        static void Idle(IOrganizationService s, Guid id, State state)
        {
            var row = Load(s, id);
            OwnClaim(row, state);
            state.Phase = "idle";
            state.Lease = 0;
            state.Expires = DateTime.UtcNow.AddMinutes(15).Ticks;
            Save(s, row, state);
        }

        static void Available(State state)
        {
            if (state != null && state.Phase != "idle" && state.Lease > Now())
                Fail("conflict");
        }

        static State Bound(Entity row, Guid actor, Guid session)
        {
            var state = Stored(row);
            if (state == null || state.Actor != actor.ToString("D") || state.Session != session.ToString("D") || state.Expires <= Now() || state.Phase != "idle" || string.IsNullOrEmpty(state.Token))
                Fail("conflict");
            return state;
        }

        static Dictionary<string, object> Begin(IOrganizationService s, Entity row, Guid actor, Dictionary<string, object> p)
        {
            Keys(p, "id", "variant", "fileName", "mimeType", "size", "sessionId");
            Guid session = Id(p, "sessionId");
            string variant = Text(p, "variant"), name = Text(p, "fileName"), mime = Text(p, "mimeType");
            int size = Int(p, "size", 1, MaxSize);
            if (variant != (Featured(row) ? "featured" : "press") || size > (Featured(row) ? 2097152 : MaxSize) || !ValidName(name, mime, Featured(row)))
                Fail("validation");
            var old = Stored(row);
            Available(old);
            if (old != null && old.Session == session.ToString("D"))
            {
                if (old.Actor != actor.ToString("D") || old.Expires <= Now() || old.Phase != "idle" || string.IsNullOrEmpty(old.Token) || old.Variant != variant || old.Name != name || old.Mime != mime || old.Size != size)
                    Fail("conflict");
                return D("ok", true, "id", row.Id.ToString("D"), "sessionId", session.ToString("D"), "chunkSize", ChunkSize, "nextIndex", old.Hashes.Count);
            }

            if (old != null && old.Expires > Now() && old.Actor != actor.ToString("D"))
                Fail("conflict");
            var state = new State
            {
                Coverage = row.Id.ToString("D"),
                Actor = actor.ToString("D"),
                Session = session.ToString("D"),
                Variant = variant,
                Name = name,
                Mime = mime,
                Size = size
            };
            Claim(s, row, state, "busy");
            var response = Native(s, "InitializeFileBlocksUpload", "Target", new EntityReference(Table, row.Id), "FileAttributeName", FileField, "FileName", name);
            state.Token = NativeText(response, "FileContinuationToken");
            Idle(s, row.Id, state);
            return D("ok", true, "id", state.Coverage, "sessionId", state.Session, "chunkSize", ChunkSize, "nextIndex", 0);
        }

        static Dictionary<string, object> Chunk(IOrganizationService s, Entity row, Guid actor, Dictionary<string, object> p)
        {
            Keys(p, "id", "sessionId", "index", "data");
            var state = Bound(row, actor, Id(p, "sessionId"));
            int index = Int(p, "index", 0, 39);
            string raw = Text(p, "data");
            byte[] bytes;
            if (raw.Length == 0 || raw.Length > 349528)
                Fail("validation");
            try
            {
                bytes = Convert.FromBase64String(raw);
            }
            catch
            {
                Fail("validation");
                return null;
            }

            if (Convert.ToBase64String(bytes) != raw || index * ChunkSize >= state.Size || bytes.Length != Math.Min(ChunkSize, state.Size - index * ChunkSize))
                Fail("validation");
            string hash;
            using (var sha = SHA256.Create())
                hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
            if (index < state.Hashes.Count)
            {
                if (state.Hashes[index] != hash)
                    Fail("conflict");
                return Progress(state);
            }

            if (index != state.Hashes.Count)
                Fail("conflict");
            if (index == 0 && !Signature(bytes, state.Mime))
                Fail("validation");
            Claim(s, row, state, "busy");
            Native(s, "UploadBlock", "BlockId", BlockId(index), "BlockData", bytes, "FileContinuationToken", state.Token);
            state.Hashes.Add(hash);
            Idle(s, row.Id, state);
            return Progress(state);
        }

        static Dictionary<string, object> Progress(State state)
        {
            return D("ok", true, "id", state.Coverage, "sessionId", state.Session, "nextIndex", state.Hashes.Count);
        }

        static Dictionary<string, object> Commit(IOrganizationService s, Entity row, Guid actor, Dictionary<string, object> p)
        {
            Keys(p, "id", "sessionId");
            var state = Bound(row, actor, Id(p, "sessionId"));
            if (state.Hashes.Count != (state.Size + ChunkSize - 1) / ChunkSize)
                Fail("conflict");
            Claim(s, row, state, "committing");
            var result = Native(s, "CommitFileBlocksUpload", "FileContinuationToken", state.Token, "FileName", state.Name, "MimeType", state.Mime, "BlockList", Enumerable.Range(0, state.Hashes.Count).Select(BlockId).ToArray());
            object file;
            if (!result.Results.TryGetValue("FileId", out file) || !(file is Guid) || (Guid)file == Guid.Empty || NativeSize(result) != state.Size)
                Fail("unavailable");
            Guid fileId = (Guid)file;
            row = Load(s, row.Id);
            OwnClaim(row, state);
            if (FileId(row) != fileId || row.GetAttributeValue<string>(NameField) != state.Name)
                Fail("unavailable");
            var metadata = DownloadMetadata(s, row);
            if (metadata.Name != state.Name || metadata.Size != state.Size)
                Fail("unavailable");
            row = Load(s, row.Id);
            OwnClaim(row, state);
            if (FileId(row) != fileId)
                Fail("conflict");
            Save(s, row, null);
            return D("ok", true, "id", state.Coverage, "fileId", fileId.ToString("D"), "fileName", state.Name, "mimeType", state.Mime, "size", state.Size);
        }

        static string BlockId(int index)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(index.ToString("D8", CultureInfo.InvariantCulture)));
        }

        sealed class Download
        {
            public string Token, Name, Mime;
            public int Size;
            public bool Chunking;
        }

        static Download DownloadMetadata(IOrganizationService s, Entity row)
        {
            var r = Native(s, "InitializeFileBlocksDownload", "Target", new EntityReference(Table, row.Id), "FileAttributeName", FileField);
            string name = NativeText(r, "FileName");
            long size = NativeSize(r);
            string mime = MimeFromName(name);
            if (size < 1 || size > (Featured(row) ? 2097152 : MaxSize) || !ValidName(name, mime, Featured(row)))
                Fail("unavailable");
            object chunking;
            if (!r.Results.TryGetValue("IsChunkingSupported", out chunking) || !(chunking is bool))
                Fail("unavailable");
            return new Download
            {
                Token = NativeText(r, "FileContinuationToken"),
                Name = name,
                Mime = mime,
                Size = (int)size,
                Chunking = (bool)chunking
            };
        }

        static Guid FileId(Entity row)
        {
            object v;
            if (!row.Attributes.TryGetValue(FileField, out v) || !(v is Guid) || (Guid)v == Guid.Empty)
                Fail("not_found");
            return (Guid)v;
        }

        static Dictionary<string, object> Info(IOrganizationService s, Entity row)
        {
            Guid fileId = FileId(row);
            var m = DownloadMetadata(s, row);
            var current = Load(s, row.Id);
            if (FileId(current) != fileId || current.GetAttributeValue<string>(NameField) != m.Name)
                Fail("conflict");
            return D("ok", true, "id", row.Id.ToString("D"), "fileId", fileId.ToString("D"), "fileName", m.Name, "mimeType", m.Mime, "size", m.Size, "chunkSize", ChunkSize);
        }

        static Dictionary<string, object> Read(IOrganizationService s, Entity row, Dictionary<string, object> p)
        {
            Guid expected = Id(p, "fileId");
            if (FileId(row) != expected)
                Fail("conflict");
            int offset = Int(p, "offset", 0, MaxSize - 1), length = Int(p, "length", 1, ChunkSize);
            var metadata = DownloadMetadata(s, row);
            if (offset > metadata.Size - length)
                Fail("validation");
            var response = Native(s, "DownloadBlock", "FileContinuationToken", metadata.Token, "Offset", (long)(metadata.Chunking ? offset : 0), "BlockLength", (long)(metadata.Chunking ? length : metadata.Size));
            object value;
            if (!response.Results.TryGetValue("Data", out value) || !(value is byte[]))
                Fail("unavailable");
            var data = (byte[])value;
            if (data.Length != (metadata.Chunking ? length : metadata.Size))
                Fail("unavailable");
            var current = Load(s, row.Id);
            if (FileId(current) != expected || current.GetAttributeValue<string>(NameField) != metadata.Name)
                Fail("conflict");
            if (!metadata.Chunking)
                data = data.Skip(offset).Take(length).ToArray();
            return D("ok", true, "id", row.Id.ToString("D"), "fileId", expected.ToString("D"), "offset", offset, "data", Convert.ToBase64String(data));
        }

        static OrganizationResponse Native(IOrganizationService s, string name, params object[] values)
        {
            var r = new OrganizationRequest(name);
            for (int i = 0; i < values.Length; i += 2)
                r[(string)values[i]] = values[i + 1];
            return s.Execute(r);
        }

        static string NativeText(OrganizationResponse r, string key)
        {
            object v;
            if (!r.Results.TryGetValue(key, out v) || !(v is string) || string.IsNullOrWhiteSpace((string)v))
                Fail("unavailable");
            return (string)v;
        }

        static long NativeSize(OrganizationResponse r)
        {
            object v;
            if (!r.Results.TryGetValue("FileSizeInBytes", out v) || !(v is long) && !(v is int))
                Fail("unavailable");
            return Convert.ToInt64(v, CultureInfo.InvariantCulture);
        }

        static string MimeFromName(string name)
        {
            string ext = Path.GetExtension(name).ToLowerInvariant();
            return ext == ".png" ? "image/png" : ext == ".jpg" || ext == ".jpeg" ? "image/jpeg" : ext == ".webp" ? "image/webp" : ext == ".pdf" ? "application/pdf" : ext == ".gif" ? "image/gif" : ext == ".xls" ? "application/vnd.ms-excel" : ext == ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "";
        }

        static bool ValidName(string name, string mime, bool featured)
        {
            return name != null && name.Length > 0 && name.Length <= 128 && name == name.Trim() && name != "." && name != ".." && !name.EndsWith(".", StringComparison.Ordinal) && !name.Any(c => char.IsControl(c) || "\\/:*?\"<>|".Contains(c)) && MimeFromName(name) == mime && mime != "" && (!featured || mime.StartsWith("image/", StringComparison.Ordinal));
        }

        static bool Signature(byte[] b, string mime)
        {
            return mime == "image/png" ? b.Length >= 8 && b.Take(8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) : mime == "image/jpeg" ? b.Length >= 3 && b[0] == 255 && b[1] == 216 && b[2] == 255 : mime == "image/webp" ? b.Length >= 12 && Encoding.ASCII.GetString(b, 0, 4) == "RIFF" && Encoding.ASCII.GetString(b, 8, 4) == "WEBP" : mime == "image/gif" ? b.Length >= 6 && (Encoding.ASCII.GetString(b, 0, 6) == "GIF87a" || Encoding.ASCII.GetString(b, 0, 6) == "GIF89a") : mime == "application/vnd.ms-excel" ? b.Length >= 8 && b.Take(8).SequenceEqual(new byte[] { 208, 207, 17, 224, 161, 177, 26, 225 }) : mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? b.Length >= 4 && b.Take(4).SequenceEqual(new byte[] { 80, 75, 3, 4 }) : mime == "application/pdf" && b.Length >= 5 && Encoding.ASCII.GetString(b, 0, 5) == "%PDF-";
        }

        static Dictionary<string, object> D(params object[] values)
        {
            var d = new Dictionary<string, object>();
            for (int i = 0; i < values.Length; i += 2)
                d.Add((string)values[i], values[i + 1]);
            return d;
        }

        static string Json(object value)
        {
            if (value == null)
                return "null";
            var d = value as Dictionary<string, object>;
            if (d != null)
                return "{" + string.Join(",", d.Select(k => Json(k.Key) + ":" + Json(k.Value))) + "}";
            if (value is bool)
                return (bool)value ? "true" : "false";
            if (value is int || value is long)
                return Convert.ToString(value, CultureInfo.InvariantCulture);
            using (var m = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(string)).WriteObject(m, (string)value);
                return Encoding.UTF8.GetString(m.ToArray());
            }
        }

        static Dictionary<string, object> Parse(string value)
        {
            if (value == null || value.Length > 351000)
                Fail("validation");
            try
            {
                using (var r = JsonReaderWriterFactory.CreateJsonReader(Encoding.UTF8.GetBytes(value), new XmlDictionaryReaderQuotas { MaxDepth = 5, MaxStringContentLength = 350000, MaxArrayLength = 50 }))
                {
                    var d = ParseNode(XElement.Load(r)) as Dictionary<string, object>;
                    if (d == null)
                        Fail("validation");
                    return d;
                }
            }
            catch (Problem)
            {
                throw;
            }
            catch
            {
                Fail("validation");
                return null;
            }
        }

        static object ParseNode(XElement node)
        {
            string type = (string)node.Attribute("type");
            if (type == "object")
            {
                var d = new Dictionary<string, object>();
                foreach (var child in node.Elements())
                {
                    string key = (string)child.Attribute("item") ?? child.Name.LocalName;
                    if (d.ContainsKey(key))
                        Fail("validation");
                    d.Add(key, ParseNode(child));
                }

                return d;
            }

            if (type == "string")
                return node.Value;
            if (type == "number")
            {
                decimal n;
                if (!decimal.TryParse(node.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out n))
                    Fail("validation");
                return n;
            }

            Fail("validation");
            return null;
        }

        static void Keys(Dictionary<string, object> p, params string[] keys)
        {
            if (p.Count != keys.Length || keys.Any(k => !p.ContainsKey(k)))
                Fail("validation");
        }

        static string Text(Dictionary<string, object> p, string key)
        {
            object v;
            if (!p.TryGetValue(key, out v) || !(v is string))
                Fail("validation");
            return (string)v;
        }

        static Guid Id(Dictionary<string, object> p, string key)
        {
            Guid id;
            if (!Guid.TryParseExact(Text(p, key), "D", out id) || id == Guid.Empty)
                Fail("validation");
            return id;
        }

        static int Int(Dictionary<string, object> p, string key, int min, int max)
        {
            object v;
            if (!p.TryGetValue(key, out v) || !(v is decimal) || (decimal)v < min || (decimal)v > max || (decimal)v != decimal.Truncate((decimal)v))
                Fail("validation");
            return (int)(decimal)v;
        }
    }
}
