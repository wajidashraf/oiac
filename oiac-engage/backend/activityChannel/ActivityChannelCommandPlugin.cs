using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
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
[assembly:System.Reflection.AssemblyVersion("1.0.0.0")]
[assembly:System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.6.2")]

namespace Oiac.Engage.ActivityChannel
{
    public sealed class ActivityChannelCommandPlugin:IPlugin
    {
        const string Post = "mss_activitypost", Comment = "mss_activitycomment";
        static readonly Guid AdminRole = new Guid("6ec72c3e-4f1b-420f-9565-d20047b12c1f"), Site = new Guid("e7f400bd-1e04-4efa-b8b3-7a7a3b168662");
        static readonly string[] PostFields = {
            "statecode", "mss_content", "mss_author", "createdon", "modifiedon", "mss_ispinned", "mss_pinnedon", "mss_pinnedby", "versionnumber"
        };
        static readonly string[] CommentFields = {
            "statecode", "mss_commenttext", "mss_author", "createdon", "mss_activitypost", "mss_parentcomment"
        };
        sealed class Problem:Exception
        {
            public string Code;
            public Problem(string c)
            {
                Code = c;
            }
        }

        static void Fail(string c)
        {
            throw new Problem(c);
        }

        public void Execute(IServiceProvider provider)
        {
            var c = (IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
            if (c.MessageName != "mss_ActivityChannelCommand")throw new InvalidPluginExecutionException("Unsupported command.");
            var f = (IOrganizationServiceFactory)provider.GetService(typeof(IOrganizationServiceFactory));
            object a, cmd, p;
            c.InputParameters.TryGetValue("ActorContactId", out a);
            c.InputParameters.TryGetValue("Command", out cmd);
            c.InputParameters.TryGetValue("Payload", out p);
            c.OutputParameters["Result"] = Run(f.CreateOrganizationService(c.UserId), a is Guid?(Guid)a:Guid.Empty, cmd as string, p as string);
        }

        public static string Run(IOrganizationService s, Guid actor, string command, string payload)
        {
            try
            {
                if (actor == Guid.Empty)Fail("unauthenticated");
                if (!Eligible(s, actor))Fail("forbidden");
                var p = Parse(payload);
                bool admin = IsAdmin(s, actor);
                if (command == "post" || command == "comment" || command == "reply")return Json(Create(s, actor, admin, command, p));
                if (command == "pin" || command == "unpin" || command == "remove")return Json(Change(s, actor, admin, command, p));
                if (command == "count")return Json(Count(s, p));
                if (command == "feed")return Json(Feed(s, actor, admin, p));
                if (command == "comments")return Json(Comments(s, p));
                Fail("validation");
                return null;
            }
            catch (Problem e)
            {
                return Error(e.Code);
            }
            catch (FaultException<OrganizationServiceFault> e)
            {
                return Error(e.Detail.ErrorCode == -2147088254?"conflict":e.Detail.ErrorCode == -2147220969?"not_found":"unavailable");
            }
            catch
            {
                return Error("unavailable");
            }
        }

        static string Error(string code)
        {
            return Json(D("ok", false, "error", D("code", code, "message", code == "validation"?"Check the activity fields and try again.":code == "conflict"?"This activity changed. Refresh and try again.":code == "unauthenticated"?"Sign in to continue.":code == "forbidden"?"You do not have permission to perform this action.":code == "not_found"?"This activity is no longer available.":"Activity Channel is temporarily unavailable.")));
        }

        static Dictionary<string, object> D(params object[] v)
        {
            var d = new Dictionary<string, object>();
            for (int i = 0; i<v.Length; i += 2)d.Add((string)v[i], v[i+1]);
            return d;
        }

        static string Json(object v)
        {
            if (v == null)return "null";
            var d = v as Dictionary<string, object>;
            if (d != null)return "{"+string.Join(",", d.Select(k=>Json(k.Key)+":"+Json(k.Value)))+"}";
            var a = v as object[];
            if (a != null)return "["+string.Join(",", a.Select(Json))+"]";
            if (v is bool)return (bool)v?"true":"false";
            if (v is int || v is long || v is decimal)return Convert.ToString(v, CultureInfo.InvariantCulture);
            using (var m = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(string)).WriteObject(m, (string)v);
                return Encoding.UTF8.GetString(m.ToArray());
            }
        }

        static Dictionary<string, object> Parse(string text)
        {
            if (text == null || text.Length>65536)Fail("validation");
            try
            {
                using (var r = JsonReaderWriterFactory.CreateJsonReader(Encoding.UTF8.GetBytes(text), new XmlDictionaryReaderQuotas
                {
                    MaxDepth = 8, MaxStringContentLength = 65536, MaxArrayLength = 100
                }))
                {
                    var p = Read(XElement.Load(r)) as Dictionary<string, object>;
                    if (p == null)Fail("validation");
                    return p;
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

        static object Read(XElement n)
        {
            string t = (string)n.Attribute("type");
            if (t == "object")
            {
                var d = new Dictionary<string, object>();
                foreach (var e in n.Elements())
                {
                    string k = (string)e.Attribute("item")??e.Name.LocalName;
                    if (d.ContainsKey(k))Fail("validation");
                    d.Add(k, Read(e));
                }
                return d;
            }
            if (t == "array")return n.Elements().Select(Read).ToArray();
            if (t == "string")return n.Value;
            if (t == "null")return null;
            if (t == "number")
            {
                decimal x;
                if (!decimal.TryParse(n.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out x))Fail("validation");
                return x;
            }
            if (t == "boolean")return n.Value == "true";
            Fail("validation");
            return null;
        }

        static void Keys(Dictionary<string, object> p, params string[] keys)
        {
            if (p.Keys.Any(k=>!keys.Contains(k)) || keys.Any(k=>!p.ContainsKey(k)))Fail("validation");
        }

        static string Text(Dictionary<string, object> p, string k)
        {
            object v;
            if (!p.TryGetValue(k, out v) || !(v is string))Fail("validation");
            return (string)v;
        }

        static Guid Id(Dictionary<string, object> p, string k)
        {
            Guid id;
            if (!Guid.TryParseExact(Text(p, k), "D", out id) || id == Guid.Empty)Fail("validation");
            return id;
        }

        static int Page(Dictionary<string, object> p)
        {
            object v;
            if (!p.TryGetValue("page", out v) || !(v is decimal) || (decimal)v<1 || (decimal)v>2500 || (decimal)v != decimal.Truncate((decimal)v))Fail("validation");
            return (int)(decimal)v;
        }

        static string Body(Dictionary<string, object> p)
        {
            string t = Text(p, "content");
            if (t.Length>8000 || string.IsNullOrWhiteSpace(t) || t.Any(c=>char.IsControl(c) && c != '\n' && c != '\r' && c != '\t'))Fail("validation");
            return t;
        }

        static Entity Find(IOrganizationService s, string table, Guid id, string[] fields)
        {
            var q = new QueryExpression(table)
            {
                ColumnSet = new ColumnSet(fields), TopCount = 1
            };
            q.Criteria.AddCondition(table+"id", ConditionOperator.Equal, id);
            return s.RetrieveMultiple(q).Entities.SingleOrDefault();
        }

        static bool Eligible(IOrganizationService s, Guid actor)
        {
            var c = s.Retrieve("contact", actor, new ColumnSet("statecode", "adx_identity_logonenabled", "adx_identity_username"));
            if (c.GetAttributeValue<OptionSetValue>("statecode") == null || c.GetAttributeValue<OptionSetValue>("statecode").Value != 0 || !c.GetAttributeValue<bool>("adx_identity_logonenabled"))return false;
            if (!string.IsNullOrWhiteSpace(c.GetAttributeValue<string>("adx_identity_username")))return true;
            var q = new QueryExpression("adx_externalidentity")
            {
                ColumnSet = new ColumnSet(false), TopCount = 1
            };
            q.Criteria.AddCondition("adx_contactid", ConditionOperator.Equal, actor);
            return s.RetrieveMultiple(q).Entities.Count>0;
        }

        static bool IsAdmin(IOrganizationService s, Guid actor)
        {
            var q = new QueryExpression("contact")
            {
                ColumnSet = new ColumnSet(false), TopCount = 1
            };
            q.Criteria.AddCondition("contactid", ConditionOperator.Equal, actor);
            var i = q.AddLink("powerpagecomponent_mspp_webrole_contact", "contactid", "contactid");
            var r = i.AddLink("powerpagecomponent", "powerpagecomponentid", "powerpagecomponentid");
            r.LinkCriteria.AddCondition("powerpagecomponentid", ConditionOperator.Equal, AdminRole);
            r.LinkCriteria.AddCondition("powerpagesiteid", ConditionOperator.Equal, Site);
            return s.RetrieveMultiple(q).Entities.Count>0;
        }

        static Guid Ref(Entity e, string k)
        {
            var r = e.GetAttributeValue<EntityReference>(k);
            return r == null?Guid.Empty:r.Id;
        }

        static Entity Active(IOrganizationService s, string table, Guid id, string[] fields)
        {
            var e = s.Retrieve(table, id, new ColumnSet(fields));
            if (e.GetAttributeValue<OptionSetValue>("statecode") == null || e.GetAttributeValue<OptionSetValue>("statecode").Value != 0)Fail("not_found");
            return e;
        }

        static Guid Deterministic(string command, Guid actor, Guid request)
        {
            using (var sha = SHA256.Create())
            {
                var b = sha.ComputeHash(Encoding.UTF8.GetBytes("activity-channel:"+command+":"+actor.ToString("D")+":"+request.ToString("D"))).Take(16).ToArray();
                b[7] = (byte)((b[7]&15)|80);
                b[8] = (byte)((b[8]&63)|128);
                return new Guid(b);
            }
        }

        static Dictionary<string, object> Create(IOrganizationService s, Guid actor, bool admin, string cmd, Dictionary<string, object> p)
        {
            Keys(p, cmd == "post"?new[]
            {
                "requestId", "content"
            }
            :cmd == "comment"?new[]
            {
                "requestId", "postId", "content"
            }
            :new[]
            {
                "requestId", "postId", "parentId", "content"
            });
            Guid id = Deterministic(cmd, actor, Id(p, "requestId")), post = Guid.Empty, parent = Guid.Empty;
            string body = Body(p), table = cmd == "post"?Post:Comment, field = cmd == "post"?"mss_content":"mss_commenttext";
            bool invalidNewReply = false;
            if (cmd != "post")
            {
                post = Id(p, "postId");
                Active(s, Post, post, PostFields);
                if (cmd == "reply")
                {
                    parent = Id(p, "parentId");
                    Guid current = parent;
                    var seen = new HashSet<Guid>();
                    for (int n = 0; current != Guid.Empty; n++)
                    {
                        if (n >= 100 || !seen.Add(current))Fail("validation");
                        Entity ancestor;
                        try
                        {
                            ancestor = Active(s, Comment, current, CommentFields);
                        }
                        catch (FaultException<OrganizationServiceFault> e)
                        {
                            if (e.Detail.ErrorCode == -2147220969)Fail("validation");
                            throw;
                        }
                        if (Ref(ancestor, "mss_activitypost") != post)Fail("validation");
                        if (n == 0 && Ref(ancestor, "mss_parentcomment") != Guid.Empty)invalidNewReply = true;
                        current = Ref(ancestor, "mss_parentcomment");
                    }
                }
            }
            // Query-before-create avoids catching a failed write inside the Dataverse transaction.
            var existing = Find(s, table, id, cmd == "post"?PostFields:CommentFields);
            if (existing != null)
            {
                if (Ref(existing, "mss_author") != actor || existing.GetAttributeValue<string>(field) != body || (cmd != "post" && (Ref(existing, "mss_activitypost") != post || Ref(existing, "mss_parentcomment") != parent)))Fail("conflict");
                if (existing.GetAttributeValue<OptionSetValue>("statecode") == null || existing.GetAttributeValue<OptionSetValue>("statecode").Value != 0)Fail("conflict");
                return D("ok", true, cmd == "post"?"post":"comment", cmd == "post"?PostDto(s, existing, actor, admin):CommentDto(s, existing));
            }
            // An exact legacy replay may return above, but new replies must target a root.
            if (invalidNewReply)Fail("validation");
            var row = new Entity(table, id);
            row[field] = body;
            row["mss_author"] = new EntityReference("contact", actor);
            row[cmd == "post"?"mss_activityname":"mss_commentname"] = (cmd == "post"?"Activity ":"Comment ")+id.ToString("D");
            if (cmd == "post")row["mss_ispinned"] = false;
            else
            {
                row["mss_activitypost"] = new EntityReference(Post, post);
                if (parent != Guid.Empty)row["mss_parentcomment"] = new EntityReference(Comment, parent);
            }
            s.Create(row);
            var saved = Active(s, table, id, cmd == "post"?PostFields:CommentFields);
            return D("ok", true, cmd == "post"?"post":"comment", cmd == "post"?PostDto(s, saved, actor, admin):CommentDto(s, saved));
        }

        static Dictionary<string, object> Change(IOrganizationService s, Guid actor, bool admin, string cmd, Dictionary<string, object> p)
        {
            Keys(p, "id", "expectedRowVersion");
            Guid id = Id(p, "id");
            string version = Text(p, "expectedRowVersion");
            if (!Regex.IsMatch(version, "^[1-9][0-9]{0,29}$"))Fail("validation");
            var old = Active(s, Post, id, PostFields);
            if (cmd == "remove"?(!admin && Ref(old, "mss_author") != actor):!admin)Fail("forbidden");
            if (old.RowVersion != version)Fail("conflict");
            if (cmd == "remove")
            {
                var target = new EntityReference(Post, id)
                {
                    RowVersion = version
                };
                s.Execute(new DeleteRequest
                {
                    Target = target, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches
                });
                return D("ok", true, "id", id.ToString("D"));
            }
            var update = new Entity(Post, id)
            {
                RowVersion = version
            };
            bool pin = cmd == "pin";
            update["mss_ispinned"] = pin;
            update["mss_pinnedon"] = pin?(object)DateTime.UtcNow:null;
            update["mss_pinnedby"] = pin?new EntityReference("contact", actor):null;
            s.Execute(new UpdateRequest
            {
                Target = update, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches
            });
            return D("ok", true, "post", PostDto(s, Active(s, Post, id, PostFields), actor, admin));
        }

        static string Date(Entity e, string f)
        {
            if (!e.Contains(f) || !(e[f] is DateTime))throw new InvalidOperationException("Missing persisted timestamp.");
            return DateTime.SpecifyKind((DateTime)e[f], DateTimeKind.Utc).ToString("o", CultureInfo.InvariantCulture);
        }

        static Dictionary<string, object> Author(IOrganizationService s, Guid id)
        {
            if (id == Guid.Empty)return D("id", null, "name", "Unknown author", "jobTitle", null);
            var q = new QueryExpression("contact")
            {
                ColumnSet = new ColumnSet("fullname", "jobtitle"), TopCount = 1
            };
            q.Criteria.AddCondition("contactid", ConditionOperator.Equal, id);
            var c = s.RetrieveMultiple(q).Entities.SingleOrDefault();
            return c == null?D("id", null, "name", "Unknown author", "jobTitle", null):D("id", id.ToString("D"), "name", string.IsNullOrWhiteSpace(c.GetAttributeValue<string>("fullname"))?"Unknown author":c.GetAttributeValue<string>("fullname"), "jobTitle", c.GetAttributeValue<string>("jobtitle"));
        }

        static Dictionary<string, object> PostDto(IOrganizationService s, Entity e, Guid actor, bool admin)
        {
            if (string.IsNullOrEmpty(e.RowVersion) || !Regex.IsMatch(e.RowVersion, "^[1-9][0-9]*$"))throw new InvalidOperationException("Missing persisted row version.");
            return D("id", e.Id.ToString("D"), "content", e.GetAttributeValue<string>("mss_content")??"", "author", Author(s, Ref(e, "mss_author")), "createdOn", Date(e, "createdon"), "modifiedOn", Date(e, "modifiedon"), "isPinned", e.GetAttributeValue<bool>("mss_ispinned"), "pinnedOn", e.Contains("mss_pinnedon") && e["mss_pinnedon"] != null?Date(e, "mss_pinnedon"):null, "pinnedById", Ref(e, "mss_pinnedby") == Guid.Empty?null:Ref(e, "mss_pinnedby").ToString("D"), "rowVersion", e.RowVersion, "canDelete", admin || Ref(e, "mss_author") == actor, "canModerate", admin);
        }

        static Dictionary<string, object> CommentDto(IOrganizationService s, Entity e)
        {
            return D("id", e.Id.ToString("D"), "postId", Ref(e, "mss_activitypost").ToString("D"), "parentId", Ref(e, "mss_parentcomment") == Guid.Empty?null:Ref(e, "mss_parentcomment").ToString("D"), "content", e.GetAttributeValue<string>("mss_commenttext")??"", "author", Author(s, Ref(e, "mss_author")), "createdOn", Date(e, "createdon"));
        }

        static EntityCollection Stream(IOrganizationService s, bool pinned, int page)
        {
            var q = new QueryExpression(Post)
            {
                ColumnSet = new ColumnSet(PostFields), PageInfo = new PagingInfo
                {
                    Count = pinned ? 20 : 10, PageNumber = page
                }
            };
            q.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            if (pinned)q.Criteria.AddCondition("mss_ispinned", ConditionOperator.Equal, true);
            else
            {
                var f = new FilterExpression(LogicalOperator.Or);
                f.AddCondition("mss_ispinned", ConditionOperator.Equal, false);
                f.AddCondition("mss_ispinned", ConditionOperator.Null);
                q.Criteria.AddFilter(f);
            }
            if (pinned)q.AddOrder("mss_pinnedon", OrderType.Descending);
            q.AddOrder("createdon", OrderType.Descending);
            q.AddOrder(Post+"id", OrderType.Ascending);
            return s.RetrieveMultiple(q);
        }

        static Dictionary<string, object> Count(IOrganizationService s, Dictionary<string, object> p)
        {
            Keys(p);
            object count = null;
            var result = s.RetrieveMultiple(new FetchExpression("<fetch aggregate='true'><entity name='mss_activitypost'><attribute name='mss_activitypostid' alias='total' aggregate='count'/><filter><condition attribute='statecode' operator='eq' value='0'/></filter></entity></fetch>"));
            if (result.Entities.Count != 1 || !(result.Entities[0]["total"] is AliasedValue))throw new InvalidOperationException();
            long total = Convert.ToInt64(((AliasedValue)result.Entities[0]["total"]).Value, CultureInfo.InvariantCulture);
            if (total<0)throw new InvalidOperationException();
            count = total;
            return D("ok", true, "totalCount", count);
        }

        static Dictionary<string, object> Feed(IOrganizationService s, Guid actor, bool admin, Dictionary<string, object> p)
        {
            Keys(p, "phase", "page");
            string phase = Text(p, "phase");
            if (phase != "pinned" && phase != "regular")Fail("validation");
            int page = Page(p);
            var rows = Stream(s, phase == "pinned", page);
            if (rows.MoreRecords && page == 2500)Fail("unavailable");
            var all = rows.Entities.ToList();
            string next = rows.MoreRecords?phase+":"+(page+1):null;
            if (phase == "pinned" && !rows.MoreRecords)
            {
                var regular = Stream(s, false, 1);
                all.AddRange(regular.Entities);
                next = regular.MoreRecords?"regular:2":null;
            }
            object count = null;
            bool unavailable = true;
            return D("ok", true, "posts", all.Select(e=>(object)PostDto(s, e, actor, admin)).ToArray(), "nextLink", next, "totalCount", count, "countUnavailable", unavailable, "currentUser", Author(s, actor), "canModerate", admin);
        }

        static Dictionary<string, object> Comments(IOrganizationService s, Dictionary<string, object> p)
        {
            Keys(p, "postIds", "page");
            int page = Page(p);
            var a = p["postIds"] as object[];
            if (a == null || a.Length<1 || a.Length>40)Fail("validation");
            var ids = a.Select(v=>Id(D("id", v), "id")).Distinct().ToArray();
            var q = new QueryExpression(Comment)
            {
                ColumnSet = new ColumnSet(CommentFields), PageInfo = new PagingInfo
                {
                    Count = 100, PageNumber = page
                }
            };
            q.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            q.Criteria.AddCondition("mss_activitypost", ConditionOperator.In, ids.Cast<object>().ToArray());
            var post = q.AddLink(Post, "mss_activitypost", Post+"id");
            post.LinkCriteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            q.AddOrder("createdon", OrderType.Ascending);
            q.AddOrder(Comment+"id", OrderType.Ascending);
            var rows = s.RetrieveMultiple(q);
            if (rows.MoreRecords && page == 2500)Fail("unavailable");
            return D("ok", true, "comments", rows.Entities.Select(e=>(object)CommentDto(s, e)).ToArray(), "nextLink", rows.MoreRecords?"comments:"+(page+1):null);
        }
    }
}
