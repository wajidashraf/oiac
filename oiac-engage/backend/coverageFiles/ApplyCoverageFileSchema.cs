// Administrative assembly only. The parent authenticates with its existing guarded UAT session.
using System;
using System.IO;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

public static class CoverageFileAdminGuard
{
    public const string Url = "https://org97063a46.crm.dynamics.com", Tenant = "11189a88-b50a-4458-8fd8-3ae0e3019c23", Environment = "16838866-275a-e2e7-838f-57313f30a416", Solution = "CRMSolution";
    public static readonly Guid Organization = new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09"), SolutionId = new Guid("dc98bc78-79ea-f011-8406-000d3a3b8459");
    public static void Require(bool value, string description)
    {
        if (!value)
            throw new InvalidOperationException("Coverage File administrative guard: " + description);
    }

    public static void Validate(IOrganizationService service, string environmentUrl, string tenantId, string environmentId)
    {
        Require(string.Equals(environmentUrl, Url, StringComparison.OrdinalIgnoreCase) && string.Equals(tenantId, Tenant, StringComparison.OrdinalIgnoreCase) && string.Equals(environmentId, Environment, StringComparison.OrdinalIgnoreCase), "approved tenant/environment required");
        var identity = (WhoAmIResponse)service.Execute(new WhoAmIRequest());
        Require(identity.OrganizationId == Organization, "connected organization mismatch");
        var solution = service.Retrieve("solution", SolutionId, new ColumnSet("uniquename"));
        Require(solution.GetAttributeValue<string>("uniquename") == Solution, "fixed solution identity");
    }
}

public static class ApplyCoverageFileSchema
{
    const string Table = "mss_presscoverage", Logical = "mss_coverageuploadstate", Schema = "mss_CoverageUploadState";
    static EntityMetadata Metadata(IOrganizationService service)
    {
        return ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest { LogicalName = Table, EntityFilters = EntityFilters.Entity | EntityFilters.Attributes, RetrieveAsIfPublished = true })).EntityMetadata;
    }

    static AttributeMetadata Attribute(EntityMetadata entity)
    {
        CoverageFileAdminGuard.Require(entity != null && entity.LogicalName == Table && entity.MetadataId.HasValue && entity.Attributes != null, "coverage table metadata");
        return entity.Attributes.SingleOrDefault(a => a.LogicalName == Logical);
    }

    static void Validate(AttributeMetadata attribute)
    {
        var memo = attribute as MemoAttributeMetadata;
        CoverageFileAdminGuard.Require(memo != null && memo.SchemaName == Schema && memo.LogicalName == Logical && memo.MaxLength == 16000 && memo.Format == StringFormat.Text && memo.RequiredLevel != null && memo.RequiredLevel.Value == AttributeRequiredLevel.None && memo.IsManaged != true, "expected nullable Memo transport column");
        CoverageFileAdminGuard.Require(memo.IsValidForAdvancedFind != null && !memo.IsValidForAdvancedFind.Value && memo.DisplayName != null && memo.DisplayName.LocalizedLabels.Any(l => l.LanguageCode == 1033 && l.Label == "Internal Coverage Upload State"), "hidden internal column labels");
    }

    static object Snapshot(AttributeMetadata attribute)
    {
        var memo = attribute as MemoAttributeMetadata;
        return attribute == null ? null : new
        {
            attribute.LogicalName,
            attribute.SchemaName,
            attribute.MetadataId,
            type = attribute.AttributeType.ToString(),
            maxLength = memo == null ? null : memo.MaxLength,
            format = memo == null ? null : memo.Format.ToString(),
            required = attribute.RequiredLevel == null ? null : attribute.RequiredLevel.Value.ToString(),
            advancedFind = attribute.IsValidForAdvancedFind == null ? (bool? )null : attribute.IsValidForAdvancedFind.Value,
            attribute.IsManaged
        };
    }

    static bool HasColumnMembership(IOrganizationService service, Guid tableMetadataId, Guid attributeMetadataId)
    {
        var attribute = new QueryExpression("solutioncomponent")
        {
            ColumnSet = new ColumnSet(false),
            TopCount = 1
        };
        attribute.Criteria.AddCondition("solutionid", ConditionOperator.Equal, CoverageFileAdminGuard.SolutionId);
        attribute.Criteria.AddCondition("objectid", ConditionOperator.Equal, attributeMetadataId);
        attribute.Criteria.AddCondition("componenttype", ConditionOperator.Equal, 2);
        if (service.RetrieveMultiple(attribute).Entities.Count == 1)
            return true;

        // Dataverse can include attributes through an existing entity component
        // without materializing separate attribute solutioncomponent rows.
        // Read this exact table's root; never add or broaden an entity component.
        var table = new QueryExpression("solutioncomponent")
        {
            ColumnSet = new ColumnSet(false),
            TopCount = 1
        };
        table.Criteria.AddCondition("solutionid", ConditionOperator.Equal, CoverageFileAdminGuard.SolutionId);
        table.Criteria.AddCondition("objectid", ConditionOperator.Equal, tableMetadataId);
        table.Criteria.AddCondition("componenttype", ConditionOperator.Equal, 1);
        table.Criteria.AddCondition("rootcomponentbehavior", ConditionOperator.Equal, 0); // IncludeSubcomponents
        return service.RetrieveMultiple(table).Entities.Count == 1;
    }

    public static void Apply(IOrganizationService service, string outputPath, string environmentUrl, string tenantId, string environmentId)
    {
        CoverageFileAdminGuard.Validate(service, environmentUrl, tenantId, environmentId);
        var metadata = Metadata(service);
        var attribute = Attribute(metadata);
        if (attribute != null)
            Validate(attribute);
        var before = Snapshot(attribute);
        File.WriteAllText(outputPath, JsonConvert.SerializeObject(new { environmentUrl, tenantId, environmentId, solution = CoverageFileAdminGuard.Solution, before, stage = "validated-before-write" }, Formatting.Indented));
        bool created = attribute == null;
        if (created)
        {
            var memo = new MemoAttributeMetadata
            {
                SchemaName = Schema,
                DisplayName = new Label("Internal Coverage Upload State", 1033),
                Description = new Label("Internal bounded coverage file transfer state. Excluded from portal forms and DTOs.", 1033),
                MaxLength = 16000,
                Format = StringFormat.Text,
                RequiredLevel = new AttributeRequiredLevelManagedProperty(AttributeRequiredLevel.None),
                IsValidForAdvancedFind = new BooleanManagedProperty(false),
                IsAuditEnabled = new BooleanManagedProperty(false)
            };
            service.Execute(new CreateAttributeRequest { EntityName = Table, Attribute = memo, SolutionUniqueName = CoverageFileAdminGuard.Solution });
            service.Execute(new PublishXmlRequest { ParameterXml = "<importexportxml><entities><entity>mss_presscoverage</entity></entities></importexportxml>" });
        }

        var after = Attribute(Metadata(service));
        Validate(after);
        CoverageFileAdminGuard.Require(after.MetadataId.HasValue, "created attribute identity");
        // Add only this approved column if it is not already explicitly or
        // transitively included. Never add the entire table or dependencies.
        if (!HasColumnMembership(service, metadata.MetadataId.Value, after.MetadataId.Value))
            service.Execute(new AddSolutionComponentRequest { ComponentId = after.MetadataId.Value, ComponentType = 2, SolutionUniqueName = CoverageFileAdminGuard.Solution, AddRequiredComponents = false });
        CoverageFileAdminGuard.Require(HasColumnMembership(service, metadata.MetadataId.Value, after.MetadataId.Value), "column solution membership");
        File.WriteAllText(outputPath, JsonConvert.SerializeObject(new { environmentUrl, tenantId, environmentId, solution = CoverageFileAdminGuard.Solution, before, after = Snapshot(after), created, otherMetadataChanged = false, coverageRecordsChanged = false }, Formatting.Indented));
    }
}
