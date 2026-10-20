using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Runtime.Remoting.Messaging;
using System.Runtime.Remoting.Proxies;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Oiac.Engage.CoverageFiles;

class CoverageFileCommandTests
{
    static readonly Guid Actor = Guid.NewGuid(), Other = Guid.NewGuid(), Row = Guid.NewGuid(), Session = Guid.NewGuid();
    static int passed, failed;
    static void Assert(bool b, string m)
    {
        if (!b)
            throw new Exception(m);
    }

    static void Test(string name, Action test)
    {
        try
        {
            test();
            passed++;
            Console.WriteLine("PASS " + name);
        }
        catch (Exception e)
        {
            failed++;
            Console.WriteLine("FAIL " + name + ": " + e.Message);
        }
    }

    static void Ok(string r)
    {
        Assert(r.Contains("\"ok\":true"), r);
        Assert(!r.Contains("token") && !r.Contains("SECRET"), "private continuation token leaked");
    }

    static void Code(string r, string code)
    {
        Assert(r.Contains("\"code\":\"" + code + "\""), r);
    }

    static string Run(Fake s, string cmd, string payload, Guid? actor = null)
    {
        return CoverageFileCommandPlugin.Run(s, actor ?? Actor, cmd, payload);
    }

    static string Begin(int size = 262151, string variant = "press", string name = "proof.png", string mime = "image/png", Guid? session = null)
    {
        return "{\"id\":\"" + Row + "\",\"variant\":\"" + variant + "\",\"fileName\":\"" + name + "\",\"mimeType\":\"" + mime + "\",\"size\":" + size + ",\"sessionId\":\"" + (session ?? Session) + "\"}";
    }

    static string Bound(Guid? session = null)
    {
        return "{\"id\":\"" + Row + "\",\"sessionId\":\"" + (session ?? Session) + "\"}";
    }

    static string Chunk(int index, byte[] data, Guid? session = null)
    {
        return Bound(session).TrimEnd('}') + ",\"index\":" + index + ",\"data\":\"" + Convert.ToBase64String(data) + "\"}";
    }

    static byte[] Png(int size)
    {
        var b = new byte[size];
        byte[] sig =
        {
            137,
            80,
            78,
            71,
            13,
            10,
            26,
            10
        };
        Array.Copy(sig, b, Math.Min(size, 8));
        for (int i = 8; i < size; i++)
            b[i] = (byte)(i % 251);
        return b;
    }

    static void Upload(Fake s, byte[] bytes)
    {
        Ok(Run(s, "begin", Begin(bytes.Length)));
        for (int i = 0; i * 262144 < bytes.Length; i++)
            Ok(Run(s, "chunk", Chunk(i, bytes.Skip(i * 262144).Take(262144).ToArray())));
        Ok(Run(s, "commit", Bound()));
    }

    static int Main()
    {
        Test("anonymous denied", () => Code(Run(new Fake(), "info", "{\"id\":\"" + Row + "\"}", Guid.Empty), "unauthenticated"));
        Test("ordered full block plus partial native reassembly and cleanup", () =>
        {
            var s = new Fake();
            var bytes = Png(262151);
            Upload(s, bytes);
            Assert(s.File.SequenceEqual(bytes), "native committed bytes");
            Assert(s.Row.GetAttributeValue<string>("mss_coverageuploadstate") == null, "state cleanup");
            Assert(s.Claims == 8, "begin/two chunks/commit each claim plus completion");
            Assert(s.Native.All(n => n != "Update"), "unbounded update");
        });
        Test("eligible external identity and inactive disabled missing identity", () =>
        {
            var s = new Fake
            {
                External = true
            };
            Ok(Run(s, "begin", Begin()));
            foreach (int denial in new[]
            {
                1,
                2,
                3
            }

            )
                Code(Run(new Fake { Denied = denial }, "begin", Begin()), "forbidden");
        });
        Test("writer creator or exact site admin including imported null creator", () =>
        {
            Code(Run(new Fake(), "begin", Begin(), Other), "forbidden");
            var s = new Fake
            {
                Admin = true
            };
            Ok(Run(s, "begin", Begin(), Other));
            Assert(s.AdminQuery, "role and site exact binding");
            s = new Fake
            {
                Imported = true
            };
            Code(Run(s, "begin", Begin()), "forbidden");
            s.Admin = true;
            Ok(Run(s, "begin", Begin()));
        });
        Test("strict extra duplicate field malformed guid and number rejection", () =>
        {
            foreach (string p in new[]
            {
                Begin().TrimEnd('}') + ",\"token\":\"x\"}",
                Begin().TrimEnd('}') + ",\"id\":\"" + Row + "\"}",
                Begin().Replace(Row.ToString(), Guid.Empty.ToString()),
                Begin().Replace("262151", "1.5"),
                Begin().Replace("262151", "0")
            }

            )
                Code(Run(new Fake(), "begin", p), "validation");
        });
        Test("stored variant size filename and MIME bounds", () =>
        {
            foreach (string p in new[]
            {
                Begin(2097153, "featured"),
                Begin(10485761),
                Begin(9, "press", "../bad.png"),
                Begin(9, "press", "a.jpg", "image/png"),
                Begin(9, "featured", "a.pdf", "application/pdf"),
                Begin(9, "press", new string ('x', 129) + ".png")
            }

            )
                Code(Run(new Fake(), "begin", p), "validation");
            Code(Run(new Fake { Featured = true }, "begin", Begin()), "validation");
        });
        Test("same session resumes exact metadata and rejects changed metadata", () =>
        {
            var s = new Fake();
            Ok(Run(s, "begin", Begin()));
            Ok(Run(s, "begin", Begin()));
            Assert(s.Native.Count(n => n == "InitializeFileBlocksUpload") == 1, "resume reinitialized");
            Code(Run(s, "begin", Begin(262150)), "conflict");
        });
        Test("ordered blocks signature exact lengths canonical base64 and replays", () =>
        {
            var s = new Fake();
            Ok(Run(s, "begin", Begin()));
            Code(Run(s, "chunk", Chunk(1, new byte[7])), "conflict");
            Code(Run(s, "chunk", Chunk(0, new byte[262144])), "validation");
            Code(Run(s, "chunk", Chunk(0, Png(262143))), "validation");
            string p = Chunk(0, Png(262144));
            Code(Run(s, "chunk", p.Replace("\"data\":\"", "\"data\":\" ")), "validation");
            Ok(Run(s, "chunk", p));
            Ok(Run(s, "chunk", p));
            Assert(s.Native.Count(n => n == "UploadBlock") == 1, "replay rewrote native block");
            var altered = Png(262144);
            altered[100] ^= 1;
            Code(Run(s, "chunk", Chunk(0, altered)), "conflict");
        });
        Test("forged stale and cross actor session reject even admin", () =>
        {
            var s = new Fake
            {
                Admin = true
            };
            Ok(Run(s, "begin", Begin()));
            Code(Run(s, "chunk", Chunk(0, Png(262144), Guid.NewGuid())), "conflict");
            Code(Run(s, "chunk", Chunk(0, Png(262144)), Other), "conflict");
            Code(Run(s, "begin", Begin(session: Guid.NewGuid()), Other), "conflict");
            Ok(Run(s, "begin", Begin(session: Guid.NewGuid())));
            Code(Run(s, "chunk", Chunk(0, Png(262144))), "conflict");
        });
        Test("commit requires all blocks and verifies returned metadata", () =>
        {
            var s = new Fake();
            Ok(Run(s, "begin", Begin()));
            Code(Run(s, "commit", Bound()), "conflict");
            s = new Fake
            {
                BadCommit = true
            };
            Ok(Run(s, "begin", Begin(8)));
            Ok(Run(s, "chunk", Chunk(0, Png(8))));
            Code(Run(s, "commit", Bound()), "unavailable");
            Assert(s.Row.GetAttributeValue<string>("mss_coverageuploadstate") != null, "false cleanup");
        });
        Test("native rowversion race stops before native operation", () =>
        {
            var s = new Fake
            {
                Race = true
            };
            Code(Run(s, "begin", Begin()), "conflict");
            Assert(s.Native.Count == 0, "native called after claim race");
        });
        Test("native SDK faults never followed by service calls", () =>
        {
            foreach (string fault in new[]
            {
                "InitializeFileBlocksUpload",
                "UploadBlock",
                "CommitFileBlocksUpload",
                "InitializeFileBlocksDownload",
                "DownloadBlock"
            }

            )
            {
                var s = new Fake();
                if (fault == "UploadBlock" || fault == "CommitFileBlocksUpload")
                {
                    Ok(Run(s, "begin", Begin(8)));
                    if (fault == "CommitFileBlocksUpload")
                        Ok(Run(s, "chunk", Chunk(0, Png(8))));
                }

                s.Fault = fault;
                string cmd = fault == "UploadBlock" ? "chunk" : fault == "CommitFileBlocksUpload" ? "commit" : fault == "InitializeFileBlocksUpload" ? "begin" : fault == "DownloadBlock" ? "read" : "info";
                string p = cmd == "begin" ? Begin() : cmd == "chunk" ? Chunk(0, Png(8)) : cmd == "commit" ? Bound() : cmd == "read" ? Read(s, 0, 8) : "{\"id\":\"" + Row + "\"}";
                Code(Run(s, cmd, p), "unavailable");
                Assert(s.AfterFault == 0, "service call after SDK fault");
            }
        });
        Test("bounded info read no native token exposed and nonchunking slice", () =>
        {
            foreach (bool chunking in new[]
            {
                true,
                false
            }

            )
            {
                var s = new Fake
                {
                    Chunking = chunking
                };
                s.File = Png(262151);
                Ok(Run(s, "info", "{\"id\":\"" + Row + "\"}"));
                string r = Run(s, "read", Read(s, 262144, 7));
                Ok(r);
                Assert(r.Contains(Convert.ToBase64String(s.File.Skip(262144).ToArray())), "wrong slice");
                Assert(r.Length < 400, "unbounded public response");
                Assert(s.LastDownloadLength == (chunking ? 7 : 262151), "native chunk support ignored");
            }
        });
        Test("read detects replacement and stale descriptor and range bounds", () =>
        {
            var s = new Fake();
            Code(Run(s, "read", Read(s, 0, 9)), "validation");
            Code(Run(s, "read", Read(s, 0, 262145)), "validation");
            Code(Run(s, "read", Read(s, -1, 1)), "validation");
            Code(Run(s, "read", Read(s, 0, 1).Replace(s.FileId.ToString(), Guid.NewGuid().ToString())), "conflict");
            s.ReplaceDuringRead = true;
            Code(Run(s, "read", Read(s, 0, 8)), "conflict");
        });
        Test("busy claim prevents replacement even owner and admin", () =>
        {
            var s = new Fake
            {
                Admin = true
            };
            Ok(Run(s, "begin", Begin()));
            s.BeforeNative = name =>
            {
                if (name == "UploadBlock")
                    Code(Run(s, "begin", Begin(session: Guid.NewGuid())), "conflict");
            };
            Ok(Run(s, "chunk", Chunk(0, Png(262144))));
        });
        Test("two competing begin commands have one native winner", () =>
        {
            var s = new Fake();
            s.BeforeClaim = () => Ok(Run(s, "begin", Begin(session: Guid.NewGuid())));
            Code(Run(s, "begin", Begin()), "conflict");
            Assert(s.Native.Count(n => n == "InitializeFileBlocksUpload") == 1, "more than one native winner");
        });
        Test("expired state requires fresh session and permits other eligible admin", () =>
        {
            var s = new Fake
            {
                Admin = true
            };
            Ok(Run(s, "begin", Begin()));
            s.Row["mss_coverageuploadstate"] = Regex.Replace(s.Row.GetAttributeValue<string>("mss_coverageuploadstate"), "\"Expires\":[0-9]+", "\"Expires\":1");
            Code(Run(s, "begin", Begin()), "conflict");
            Code(Run(s, "chunk", Chunk(0, Png(262144))), "conflict");
            Ok(Run(s, "begin", Begin(session: Guid.NewGuid()), Other));
        });
        Test("full forty block exact ten MiB press boundary", () =>
        {
            var s = new Fake();
            byte[] bytes = Png(10485760);
            Upload(s, bytes);
            Assert(s.File.SequenceEqual(bytes), "max-size bytes changed");
            Assert(s.Native.Count(n => n == "UploadBlock") == 40, "wrong block count");
        });
        Test("featured PNG two MiB succeeds and PDF is rejected on featured record", () =>
        {
            var s = new Fake
            {
                Featured = true
            };
            Code(Run(s, "begin", Begin(9, "featured", "proof.pdf", "application/pdf")), "validation");
            Ok(Run(s, "begin", Begin(2097152, "featured")));
            for (int i = 0; i < 8; i++)
                Ok(Run(s, "chunk", Chunk(i, i == 0 ? Png(262144) : new byte[262144])));
            Ok(Run(s, "commit", Bound()));
        });
        Test("press PDF JPEG and WebP signature allowlists", () =>
        {
            var cases = new[]
            {
                new
                {
                    N = "proof.pdf",
                    M = "application/pdf",
                    B = System.Text.Encoding.ASCII.GetBytes("%PDF-1.7")
                },
                new
                {
                    N = "proof.jpg",
                    M = "image/jpeg",
                    B = new byte[]
                    {
                        255,
                        216,
                        255,
                        0
                    }
                },
                new
                {
                    N = "proof.webp",
                    M = "image/webp",
                    B = System.Text.Encoding.ASCII.GetBytes("RIFF0000WEBP")
                }
            };
            foreach (var c in cases)
            {
                var s = new Fake();
                Ok(Run(s, "begin", Begin(c.B.Length, "press", c.N, c.M)));
                Ok(Run(s, "chunk", Chunk(0, c.B)));
                Ok(Run(s, "commit", Bound()));
            }
        });
        Test("GIF Excel signatures and download MIME with image-only featured policy", () =>
        {
            var cases = new[] {
                new { N = "proof.gif", M = "image/gif", B = System.Text.Encoding.ASCII.GetBytes("GIF87a") },
                new { N = "proof.gif", M = "image/gif", B = System.Text.Encoding.ASCII.GetBytes("GIF89a") },
                new { N = "proof.xls", M = "application/vnd.ms-excel", B = new byte[] {208,207,17,224,161,177,26,225} },
                new { N = "proof.xlsx", M = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", B = new byte[] {80,75,3,4} }
            };
            foreach (var c in cases) {
                var s = new Fake();
                Ok(Run(s, "begin", Begin(c.B.Length, "press", c.N, c.M)));
                Ok(Run(s, "chunk", Chunk(0, c.B)));
                Ok(Run(s, "commit", Bound()));
                string info = Run(s, "info", "{\"id\":\"" + Row + "\"}");
                Ok(info); Assert(info.Replace("\\/", "/").Contains(c.M), "wrong download MIME: " + info);
                var bad = new Fake();
                Ok(Run(bad, "begin", Begin(8, "press", c.N, c.M)));
                Code(Run(bad, "chunk", Chunk(0, new byte[8])), "validation");
                var featured = new Fake { Featured = true };
                string result = Run(featured, "begin", Begin(c.B.Length, "featured", c.N, c.M));
                if (c.M == "image/gif") Ok(result); else Code(result, "validation");
                Code(Run(new Fake(), "begin", Begin(8, "press", "bad.xlsm", c.M)), "validation");
            }
        });
        Test("plugin guards message and runs service as context UserId", () =>
        {
            var s = new Fake();
            var host = new Host(s);
            new CoverageFileCommandPlugin().Execute(host);
            Ok((string)host.Output["Result"]);
            Assert(host.CreatedUser == host.User && host.CreatedUser != Guid.Empty, "SYSTEM or wrong service identity");
            host.Message = "Update";
            host.CreatedUser = Guid.Empty;
            bool rejected = false;
            try
            {
                new CoverageFileCommandPlugin().Execute(host);
            }
            catch (InvalidPluginExecutionException)
            {
                rejected = true;
            }

            Assert(rejected && host.CreatedUser == Guid.Empty, "unsupported message reached service");
        });
        Test("persisted metadata is revalidated against featured maximum", () =>
        {
            var s = new Fake { Featured = true };
            Ok(Run(s, "begin", Begin(8, "featured")));
            s.Row["mss_coverageuploadstate"] = s.Row.GetAttributeValue<string>("mss_coverageuploadstate").Replace("\"Size\":8", "\"Size\":2097153");
            Code(Run(s, "begin", Begin(8, "featured")), "unavailable");
        });
        Console.WriteLine(passed + " passed, " + failed + " failed");
        return failed == 0 ? 0 : 1;
    }

    static string Read(Fake s, int offset, int length)
    {
        return "{\"id\":\"" + Row + "\",\"fileId\":\"" + s.FileId + "\",\"offset\":" + offset + ",\"length\":" + length + "}";
    }

    class Context : RealProxy
    {
        readonly Host host;
        public Context(Host h) : base(typeof(IPluginExecutionContext))
        {
            host = h;
        }

        public override IMessage Invoke(IMessage message)
        {
            var call = (IMethodCallMessage)message;
            object result = call.MethodName == "get_MessageName" ? (object)host.Message : call.MethodName == "get_UserId" ? (object)host.User : call.MethodName == "get_InputParameters" ? host.Input : call.MethodName == "get_OutputParameters" ? host.Output : null;
            return new ReturnMessage(result, null, 0, call.LogicalCallContext, call);
        }
    }

    class Host : IServiceProvider, IOrganizationServiceFactory
    {
        public Guid User = Guid.NewGuid(), CreatedUser;
        public string Message = "mss_CoverageFileCommand";
        public ParameterCollection Input = new ParameterCollection(), Output = new ParameterCollection();
        readonly Fake service;
        public Host(Fake s)
        {
            service = s;
            Input["ActorContactId"] = Actor;
            Input["Command"] = "info";
            Input["Payload"] = "{\"id\":\"" + Row + "\"}";
        }

        public object GetService(Type type)
        {
            return type == typeof(IPluginExecutionContext) ? new Context(this).GetTransparentProxy() : type == typeof(IOrganizationServiceFactory) ? (object)this : null;
        }

        public IOrganizationService CreateOrganizationService(Guid? id)
        {
            CreatedUser = id ?? Guid.Empty;
            return service;
        }
    }

    class Fake : IOrganizationService
    {
        public Entity Row = new Entity("mss_presscoverage", CoverageFileCommandTests.Row)
        {
            RowVersion = "1"
        };
        public Guid FileId = Guid.NewGuid();
        public byte[] File = Png(8);
        public bool Admin, AdminQuery, Imported, Featured, External, Race, BadCommit, ReplaceDuringRead, Chunking = true;
        public int Denied, Claims, AfterFault, LastDownloadLength;
        public string Fault;
        bool faulted;
        int version = 1;
        public Action BeforeClaim;
        public Action<string> BeforeNative;
        public List<string> Native = new List<string>();
        Dictionary<string, byte[]> blocks = new Dictionary<string, byte[]>();
        string uploadName;
        public Fake()
        {
            Row["mss_submittedby"] = new EntityReference("contact", Actor);
            Row["mss_isfeatured"] = false;
            Row["mss_coveragefile"] = FileId;
            Row["mss_coveragefile_name"] = "proof.png";
        }

        void Called()
        {
            if (faulted)
                AfterFault++;
        }

        public Entity Retrieve(string name, Guid id, ColumnSet cols)
        {
            Called();
            if (name == "contact")
            {
                var c = new Entity(name, id);
                c["statecode"] = new OptionSetValue(Denied == 1 ? 1 : 0);
                c["adx_identity_logonenabled"] = Denied != 2;
                c["adx_identity_username"] = Denied == 3 || External ? null : "user";
                return c;
            }

            Assert(name == "mss_presscoverage" && id == CoverageFileCommandTests.Row, "arbitrary table/record");
            Row["mss_isfeatured"] = Featured;
            Row["mss_submittedby"] = Imported ? null : new EntityReference("contact", Actor);
            var e = new Entity(name, id)
            {
                RowVersion = Row.RowVersion
            };
            foreach (var kv in Row.Attributes)
                e[kv.Key] = kv.Value;
            return e;
        }

        public EntityCollection RetrieveMultiple(QueryBase query)
        {
            Called();
            var q = (QueryExpression)query;
            if (q.EntityName == "adx_externalidentity")
                return new EntityCollection(External ? new[] { new Entity(q.EntityName) } : new Entity[0]);
            Assert(q.EntityName == "contact", "unexpected auth query");
            var role = q.LinkEntities.Single().LinkEntities.Single();
            AdminQuery = role.LinkCriteria.Conditions.Any(c => c.AttributeName == "powerpagecomponentid" && Equals(c.Values[0], new Guid("6ec72c3e-4f1b-420f-9565-d20047b12c1f"))) && role.LinkCriteria.Conditions.Any(c => c.AttributeName == "powerpagesiteid" && Equals(c.Values[0], new Guid("e7f400bd-1e04-4efa-b8b3-7a7a3b168662")));
            return new EntityCollection(Admin && AdminQuery ? new[] { new Entity("contact", Actor) } : new Entity[0]);
        }

        public OrganizationResponse Execute(OrganizationRequest r)
        {
            Called();
            var update = r as UpdateRequest;
            if (update != null)
            {
                Assert(update.ConcurrencyBehavior == ConcurrencyBehavior.IfRowVersionMatches, "missing native CAS");
                Assert(update.Target.Attributes.Count == 1 && update.Target.Contains("mss_coverageuploadstate"), "business field mutated");
                if (BeforeClaim != null)
                {
                    var callback = BeforeClaim;
                    BeforeClaim = null;
                    callback();
                }

                if (Race || update.Target.RowVersion != Row.RowVersion)
                    throw new FaultException<OrganizationServiceFault>(new OrganizationServiceFault { ErrorCode = -2147088254 });
                foreach (var kv in update.Target.Attributes)
                    Row[kv.Key] = kv.Value;
                Row.RowVersion = (++version).ToString();
                Claims++;
                return new UpdateResponse();
            }

            Native.Add(r.RequestName);
            if (BeforeNative != null)
                BeforeNative(r.RequestName);
            if (Fault == r.RequestName)
            {
                faulted = true;
                throw new FaultException<OrganizationServiceFault>(new OrganizationServiceFault { ErrorCode = -1, Message = "SECRET native failure" });
            }

            var reply = new OrganizationResponse();
            if (r.RequestName == "InitializeFileBlocksUpload")
            {
                Assert(Claims > 0, "native before claim");
                uploadName = (string)r["FileName"];
                blocks.Clear();
                reply["FileContinuationToken"] = "SECRET-upload";
            }
            else if (r.RequestName == "UploadBlock")
            {
                Assert((string)r["FileContinuationToken"] == "SECRET-upload", "caller token");
                var id = (string)r["BlockId"];
                Assert(Convert.FromBase64String(id).Length == 8, "block ids not fixed width");
                blocks[id] = (byte[])r["BlockData"];
            }
            else if (r.RequestName == "CommitFileBlocksUpload")
            {
                Assert((string)r["FileContinuationToken"] == "SECRET-upload", "commit token");
                File = ((string[])r["BlockList"]).SelectMany(id => blocks[id]).ToArray();
                FileId = Guid.NewGuid();
                Row["mss_coveragefile"] = FileId;
                Row["mss_coveragefile_name"] = uploadName;
                Row.RowVersion = (++version).ToString();
                reply["FileId"] = FileId;
                reply["FileSizeInBytes"] = (long)(File.Length + (BadCommit ? 1 : 0));
            }
            else if (r.RequestName == "InitializeFileBlocksDownload")
            {
                reply["FileContinuationToken"] = "SECRET-download";
                reply["FileName"] = Row["mss_coveragefile_name"];
                reply["FileSizeInBytes"] = (long)File.Length;
                reply["IsChunkingSupported"] = Chunking;
            }
            else if (r.RequestName == "DownloadBlock")
            {
                Assert((string)r["FileContinuationToken"] == "SECRET-download", "download token");
                LastDownloadLength = Convert.ToInt32(r["BlockLength"]);
                reply["Data"] = File.Skip(Convert.ToInt32(r["Offset"])).Take(LastDownloadLength).ToArray();
                if (ReplaceDuringRead)
                {
                    FileId = Guid.NewGuid();
                    Row["mss_coveragefile"] = FileId;
                }
            }
            else
                throw new Exception("unexpected native message " + r.RequestName);
            return reply;
        }

        public Guid Create(Entity e)
        {
            throw new Exception("unexpected create");
        }

        public void Update(Entity e)
        {
            throw new Exception("unconditional update");
        }

        public void Delete(string n, Guid id)
        {
            throw new Exception("unexpected delete");
        }

        public void Associate(string n, Guid id, Relationship r, EntityReferenceCollection es)
        {
            throw new NotImplementedException();
        }

        public void Disassociate(string n, Guid id, Relationship r, EntityReferenceCollection es)
        {
            throw new NotImplementedException();
        }
    }
}
