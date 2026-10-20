using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

class CoverageFilesAdminTests
{
    static int passed, failed;
    static string Output;
    static void Assert(bool b, string message)
    {
        if (!b)
            throw new Exception(message);
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

    static void Rejected(Action action)
    {
        bool rejected = false;
        try
        {
            action();
        }
        catch (InvalidOperationException)
        {
            rejected = true;
        }

        Assert(rejected, "expected rejection");
    }

    static void Apply(Fake s)
    {
        ApplyCoverageFileSchema.Apply(s, Output, CoverageFileAdminGuard.Url, CoverageFileAdminGuard.Tenant, CoverageFileAdminGuard.Environment);
    }

    static int Main(string[] args)
    {
        Output = Path.Combine(args[0], "schema-fake-snapshot.json");
        Test("wrong tenant guard rejects before any SDK call", () =>
        {
            var s = new Fake();
            Rejected(() => ApplyCoverageFileSchema.Apply(s, Output, CoverageFileAdminGuard.Url, Guid.NewGuid().ToString(), CoverageFileAdminGuard.Environment));
            Assert(s.Calls == 0, "SDK call despite guard rejection");
        });
        Test("wrong actual connected organization rejects before mutation", () =>
        {
            var s = new Fake
            {
                WrongOrg = true
            };
            Rejected(() => Apply(s));
            Assert(s.Writes.Count == 0, "wrong org mutated");
        });
        Test("fixed solution mismatches reject before mutation", () =>
        {
            var s = new Fake
            {
                WrongSolution = true
            };
            Rejected(() => Apply(s));
            Assert(s.Writes.Count == 0, "wrong solution mutated");
        });
        Test("absent column creates only fixed memo plus publish and solution membership", () =>
        {
            var s = new Fake();
            Apply(s);
            Assert(s.Writes.SequenceEqual(new[] { "CreateAttribute", "PublishXml", "AddSolutionComponent" }), string.Join(",", s.Writes));
            Assert(s.Column.MaxLength == 16000 && s.Column.SchemaName == "mss_CoverageUploadState" && s.Column.RequiredLevel.Value == AttributeRequiredLevel.None, "column contract");
            string snapshot = File.ReadAllText(Output);
            Assert(snapshot.Contains("before") && snapshot.Contains("after") && snapshot.Contains("coverageRecordsChanged"), "before/after manifest");
        });
        Test("already correct member column makes no metadata writes", () =>
        {
            var s = new Fake
            {
                Column = Correct(),
                Member = true
            };
            Apply(s);
            Assert(s.Writes.Count == 0, "idempotent schema changed");
        });
        Test("whole coverage table membership includes column without child component", () =>
        {
            var s = new Fake
            {
                Column = Correct(),
                InheritedMembership = true
            };
            Apply(s);
            Assert(s.Writes.Count == 0, "inherited membership caused metadata or solution writes");
            Assert(s.CheckedTableRoot, "exact table include-subcomponents membership was not checked");
        });
        Test("table shell and unrelated roots cannot satisfy column membership", () =>
        {
            foreach (int root in new[] { 1, 2, 3 })
            {
                var s = new Fake
                {
                    Column = Correct(),
                    InheritedMembership = true,
                    InvalidRoot = root
                };
                Rejected(() => Apply(s));
                Assert(s.Writes.SequenceEqual(new[] { "AddSolutionComponent" }), "invalid root widened schema write scope");
            }
        });
        Test("unexpected existing schema fails closed without mutation", () =>
        {
            foreach (int kind in new[]
            {
                1,
                2,
                3,
                4,
                5
            }

            )
            {
                var c = Correct();
                if (kind == 1)
                    c.MaxLength = 16001;
                if (kind == 2)
                    c.SchemaName = "mss_other";
                if (kind == 3)
                    c.RequiredLevel = new AttributeRequiredLevelManagedProperty(AttributeRequiredLevel.ApplicationRequired);
                if (kind == 4)
                    c.IsValidForAdvancedFind = new BooleanManagedProperty(true);
                if (kind == 5)
                    c.Format = StringFormat.Email;
                var s = new Fake
                {
                    Column = c
                };
                Rejected(() => Apply(s));
                Assert(s.Writes.Count == 0, "unexpected column modified");
            }
        });
        Test("registration malformed existing action rejected before assembly update", () =>
        {
            var s = new Fake
            {
                BadRegistration = true
            };
            Rejected(() => RegisterCoverageFileCommand.Apply(s, Path.Combine(args[0], "Oiac.Engage.CoverageFiles.dll"), Output, CoverageFileAdminGuard.Url, CoverageFileAdminGuard.Tenant, CoverageFileAdminGuard.Environment));
            Assert(s.Writes.Count == 0, "registration mutated before validation");
        });
        Console.WriteLine(passed + " administrative passed, " + failed + " failed");
        return failed == 0 ? 0 : 1;
    }

    static MemoAttributeMetadata Correct()
    {
        return new MemoAttributeMetadata
        {
            LogicalName = "mss_coverageuploadstate",
            SchemaName = "mss_CoverageUploadState",
            MetadataId = Guid.NewGuid(),
            MaxLength = 16000,
            Format = StringFormat.Text,
            RequiredLevel = new AttributeRequiredLevelManagedProperty(AttributeRequiredLevel.None),
            IsValidForAdvancedFind = new BooleanManagedProperty(false),
            DisplayName = new Label("Internal Coverage Upload State", 1033)
        };
    }

    class Fake : IOrganizationService
    {
        public int Calls;
        public bool WrongOrg, WrongSolution, Member, BadRegistration, InheritedMembership, CheckedTableRoot;
        public int InvalidRoot;
        static readonly Guid TableId = new Guid("7c0d3472-218b-4514-b40a-896c9985c85d");
        public MemoAttributeMetadata Column;
        public List<string> Writes = new List<string>();
        public OrganizationResponse Execute(OrganizationRequest request)
        {
            Calls++;
            if (request is WhoAmIRequest)
            {
                var r = new WhoAmIResponse();
                r["OrganizationId"] = WrongOrg ? Guid.NewGuid() : CoverageFileAdminGuard.Organization;
                return r;
            }

            if (request is RetrieveEntityRequest)
            {
                var r = new RetrieveEntityResponse();
                var entity = new EntityMetadata
                {
                    LogicalName = "mss_presscoverage",
                    MetadataId = TableId
                };
                typeof(EntityMetadata).GetProperty("Attributes").SetValue(entity, Column == null ? new AttributeMetadata[0] : new AttributeMetadata[] { Column }, null);
                r["EntityMetadata"] = entity;
                return r;
            }

            if (request is CreateAttributeRequest)
            {
                Writes.Add(request.RequestName);
                var r = (CreateAttributeRequest)request;
                Assert(r.EntityName == "mss_presscoverage" && r.SolutionUniqueName == "CRMSolution", "schema scope");
                Column = (MemoAttributeMetadata)r.Attribute;
                Column.LogicalName = "mss_coverageuploadstate";
                Column.MetadataId = Guid.NewGuid();
                return new CreateAttributeResponse();
            }

            if (request is PublishXmlRequest)
            {
                Writes.Add(request.RequestName);
                Assert(((PublishXmlRequest)request).ParameterXml == "<importexportxml><entities><entity>mss_presscoverage</entity></entities></importexportxml>", "publish scope");
                return new PublishXmlResponse();
            }

            if (request is AddSolutionComponentRequest)
            {
                Writes.Add(request.RequestName);
                var r = (AddSolutionComponentRequest)request;
                Assert(r.ComponentType == 2 && r.ComponentId == Column.MetadataId && r.SolutionUniqueName == "CRMSolution" && !r.AddRequiredComponents, "solution scope");
                if (!InheritedMembership)
                    Member = true;
                return new AddSolutionComponentResponse();
            }

            throw new Exception("unexpected message " + request.RequestName);
        }

        public Entity Retrieve(string table, Guid id, ColumnSet fields)
        {
            Calls++;
            Assert(table == "solution" && id == CoverageFileAdminGuard.SolutionId, "arbitrary guard record");
            var e = new Entity(table, id);
            e["uniquename"] = WrongSolution ? "WrongSolution" : "CRMSolution";
            return e;
        }

        public EntityCollection RetrieveMultiple(QueryBase query)
        {
            Calls++;
            var q = (QueryExpression)query;
            if (q.EntityName == "solutioncomponent")
            {
                var type = q.Criteria.Conditions.SingleOrDefault(c => c.AttributeName == "componenttype");
                if (type != null && Equals(type.Values[0], 1))
                {
                    Assert(q.Criteria.Conditions.Any(c => c.AttributeName == "solutionid" && Equals(c.Values[0], CoverageFileAdminGuard.SolutionId)), "table membership solution scope");
                    Assert(q.Criteria.Conditions.Any(c => c.AttributeName == "objectid" && Equals(c.Values[0], TableId)), "table membership metadata scope");
                    CheckedTableRoot = true;
                    var root = new Entity("solutioncomponent", Guid.NewGuid());
                    root["rootcomponentbehavior"] = new OptionSetValue(InvalidRoot == 1 ? 1 : 0);
                    root["componenttype"] = new OptionSetValue(InvalidRoot == 2 ? 2 : 1);
                    root["objectid"] = InvalidRoot == 3 ? Guid.NewGuid() : TableId;
                    var checksMatch = q.Criteria.Conditions.All(c => c.AttributeName == "solutionid" || root.Contains(c.AttributeName) && Equals(root[c.AttributeName] is OptionSetValue ? (object)((OptionSetValue)root[c.AttributeName]).Value : root[c.AttributeName], c.Values[0]));
                    return new EntityCollection(InheritedMembership && checksMatch ? new[] { root } : new Entity[0]);
                }
                return new EntityCollection(Member || BadRegistration ? new[] { new Entity(q.EntityName) } : new Entity[0]);
            }
            if (q.EntityName == "solution")
            {
                var e = new Entity("solution", CoverageFileAdminGuard.SolutionId);
                return new EntityCollection(new[] { e });
            }

            if (q.EntityName == "privilege")
            {
                var e = new Entity(q.EntityName, Guid.NewGuid());
                e["name"] = "prvReadmss_PressCoverage";
                return new EntityCollection(new[] { e });
            }

            if (BadRegistration && q.EntityName == "customapi")
            {
                var e = new Entity(q.EntityName, Guid.NewGuid());
                e["bindingtype"] = new OptionSetValue(1);
                e["isfunction"] = false;
                e["allowedcustomprocessingsteptype"] = new OptionSetValue(0);
                return new EntityCollection(new[] { e });
            }

            return new EntityCollection();
        }

        public Guid Create(Entity e)
        {
            Writes.Add("Create:" + e.LogicalName);
            throw new Exception("unexpected create");
        }

        public void Update(Entity e)
        {
            Writes.Add("Update:" + e.LogicalName);
            throw new Exception("unexpected update");
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
