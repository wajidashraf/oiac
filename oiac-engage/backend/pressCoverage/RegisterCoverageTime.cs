// Administrative registration tool only; never shipped inside the plug-in DLL.
// The caller must authenticate to the explicitly approved Test/UAT environment.
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

public static class RegisterCoverageTime {
 const string Solution = "CRMSolution", Api = "mss_CoverageLocalTime";
 const string TypeName = "Oiac.Engage.PressCoverage.CoverageTimePlugin";
 const string Privilege = "prvReadmss_PressCoverage";

 static Entity Find(IOrganizationService service, string table, string field, string value, params string[] columns) {
  var query = new QueryExpression(table) { ColumnSet = new ColumnSet(columns), TopCount = 2 };
  query.Criteria.AddCondition(field, ConditionOperator.Equal, value);
  var found = service.RetrieveMultiple(query).Entities;
  if (found.Count > 1) throw new InvalidOperationException("Ambiguous existing " + table + ".");
  return found.SingleOrDefault();
 }
 static Guid Create(IOrganizationService service, Entity entity) {
  var request = new CreateRequest { Target = entity };
  request.Parameters["SolutionUniqueName"] = Solution;
  return ((CreateResponse)service.Execute(request)).id;
 }
 static void Require(bool condition, string description) {
  if (!condition) throw new InvalidOperationException("Existing registration differs: " + description);
 }
 static void RequireMembership(IOrganizationService service, Guid id) {
  var solution = Find(service, "solution", "uniquename", Solution, "solutionid");
  Require(solution != null, "target solution");
  var query = new QueryExpression("solutioncomponent") { ColumnSet = new ColumnSet(false), TopCount = 1 };
  query.Criteria.AddCondition("solutionid", ConditionOperator.Equal, solution.Id);
  query.Criteria.AddCondition("objectid", ConditionOperator.Equal, id);
  Require(service.RetrieveMultiple(query).Entities.Count == 1, "CRMSolution membership for " + id);
 }
 static void CheckMembers(IOrganizationService service, Guid apiId, bool response) {
  string table = response ? "customapiresponseproperty" : "customapirequestparameter";
  var query = new QueryExpression(table) { ColumnSet = response ? new ColumnSet("uniquename", "type") : new ColumnSet("uniquename", "type", "isoptional") };
  query.Criteria.AddCondition("customapiid", ConditionOperator.Equal, apiId);
  var rows = service.RetrieveMultiple(query).Entities;
  string[] names = response ? new[] { "LocalTime" } : new[] { "UtcTime" };
  Require(rows.All(row => names.Contains(row.GetAttributeValue<string>("uniquename"))) && rows.Select(row => row.GetAttributeValue<string>("uniquename")).Distinct().Count() == rows.Count, "exact API members");
  foreach (var row in rows) {
   Require(row.GetAttributeValue<OptionSetValue>("type").Value == 10, "member type");
   if (!response) Require(!row.GetAttributeValue<bool>("isoptional"), "required member");
   RequireMembership(service, row.Id);
  }
 }
 static void Parameter(IOrganizationService service, Guid apiId, string name, int type, bool response) {
  string table = response ? "customapiresponseproperty" : "customapirequestparameter";
  var query = new QueryExpression(table) { ColumnSet = new ColumnSet("uniquename", "type", "isoptional"), TopCount = 2 };
  if (response) query.ColumnSet = new ColumnSet("uniquename", "type");
  query.Criteria.AddCondition("customapiid", ConditionOperator.Equal, apiId);
  query.Criteria.AddCondition("uniquename", ConditionOperator.Equal, name);
  var rows = service.RetrieveMultiple(query).Entities;
  Require(rows.Count <= 1, name + " uniqueness");
  if (rows.Count == 1) {
   Require(rows[0].GetAttributeValue<OptionSetValue>("type").Value == type, name + " type");
   if (!response) Require(!rows[0].GetAttributeValue<bool>("isoptional"), name + " required");
   return;
  }
  var parameter = new Entity(table);
  parameter["customapiid"] = new EntityReference("customapi", apiId);
  parameter["name"] = Api + "." + name;
  parameter["displayname"] = name;
  parameter["uniquename"] = name;
  parameter["type"] = new OptionSetValue(type);
  if (!response) parameter["isoptional"] = false;
  Create(service, parameter);
 }
 public static void Apply(IOrganizationService service, string dllPath, string outputPath) {
  byte[] bytes = File.ReadAllBytes(dllPath);
  var identity = AssemblyName.GetAssemblyName(dllPath);
  Require(identity.Name == "Oiac.Engage.CoverageTime" && identity.Version.ToString() == "1.0.0.0", "assembly identity");
  string token = BitConverter.ToString(identity.GetPublicKeyToken()).Replace("-", "").ToLowerInvariant();
  Require(token.Length == 16, "strong-name token");
  var assembly = Find(service, "pluginassembly", "name", identity.Name, "name", "version", "publickeytoken", "isolationmode", "sourcetype");
  var plugin = Find(service, "plugintype", "typename", TypeName, "pluginassemblyid");
  var api = Find(service, "customapi", "uniquename", Api, "bindingtype", "isfunction", "allowedcustomprocessingsteptype", "executeprivilegename", "plugintypeid");
  // Validate every existing component before changing the assembly on a retry.
  if (plugin != null) Require(assembly != null && plugin.GetAttributeValue<EntityReference>("pluginassemblyid").Id == assembly.Id, "plug-in assembly");
  if (api != null) {
   Require(api.GetAttributeValue<OptionSetValue>("bindingtype").Value == 0 && !api.GetAttributeValue<bool>("isfunction") && api.GetAttributeValue<OptionSetValue>("allowedcustomprocessingsteptype").Value == 0, "action binding/processing");
   Require(api.GetAttributeValue<string>("executeprivilegename") == Privilege && plugin != null && api.GetAttributeValue<EntityReference>("plugintypeid").Id == plugin.Id, "action privilege/handler");
   RequireMembership(service, api.Id); CheckMembers(service, api.Id, false); CheckMembers(service, api.Id, true);
  }
  Guid assemblyId;
  if (assembly == null) {
   assembly = new Entity("pluginassembly");
   assembly["name"] = identity.Name; assembly["version"] = identity.Version.ToString();
   assembly["culture"] = "neutral"; assembly["publickeytoken"] = token;
   assembly["isolationmode"] = new OptionSetValue(2); // Sandbox
   assembly["sourcetype"] = new OptionSetValue(0); // Database
   assembly["content"] = Convert.ToBase64String(bytes);
   assemblyId = Create(service, assembly);
  } else {
   Require(assembly.GetAttributeValue<string>("publickeytoken") == token, "assembly signing key");
   Require(assembly.GetAttributeValue<string>("version") == identity.Version.ToString(), "assembly version");
   Require(assembly.GetAttributeValue<OptionSetValue>("isolationmode").Value == 2 && assembly.GetAttributeValue<OptionSetValue>("sourcetype").Value == 0, "sandbox/database");
   assemblyId = assembly.Id;
   var update = new Entity("pluginassembly", assemblyId); update["content"] = Convert.ToBase64String(bytes); service.Update(update);
  }
  Guid pluginId;
  if (plugin == null) {
   plugin = new Entity("plugintype"); plugin["typename"] = TypeName; plugin["name"] = TypeName;
   plugin["friendlyname"] = "OIAC Coverage Local Time";
   plugin["pluginassemblyid"] = new EntityReference("pluginassembly", assemblyId);
   pluginId = Create(service, plugin);
  } else {
   Require(plugin.GetAttributeValue<EntityReference>("pluginassemblyid").Id == assemblyId, "plug-in assembly");
   pluginId = plugin.Id;
  }
  Guid apiId;
  if (api == null) {
   api = new Entity("customapi"); api["uniquename"] = Api; api["name"] = Api;
   api["displayname"] = "OIAC Coverage Local Time";
   api["description"] = "Read-only native Dataverse time conversion with fixed Jordan business timezone129.";
   api["bindingtype"] = new OptionSetValue(0); api["isfunction"] = false; api["isprivate"] = false;
   api["allowedcustomprocessingsteptype"] = new OptionSetValue(0);
   api["executeprivilegename"] = Privilege;
   api["plugintypeid"] = new EntityReference("plugintype", pluginId);
   apiId = Create(service, api);
  } else {
   Require(api.GetAttributeValue<OptionSetValue>("bindingtype").Value == 0 && !api.GetAttributeValue<bool>("isfunction") && api.GetAttributeValue<OptionSetValue>("allowedcustomprocessingsteptype").Value == 0, "action binding/processing");
   Require(api.GetAttributeValue<string>("executeprivilegename") == Privilege && api.GetAttributeValue<EntityReference>("plugintypeid").Id == pluginId, "action privilege/handler");
   apiId = api.Id;
  }
  Parameter(service, apiId, "UtcTime", 10, false); // String
  Parameter(service, apiId, "LocalTime", 10, true);
  RequireMembership(service, apiId); CheckMembers(service, apiId, false); CheckMembers(service, apiId, true);
  service.Execute(new AddSolutionComponentRequest { ComponentId = assemblyId, ComponentType = 91, SolutionUniqueName = Solution, AddRequiredComponents = false });
  // Plugin types travel inside their assembly. This environment resolves a
  // separate type (90) add as an assembly reference and rejects the type ID.
  // Verify the linked type above and add the assembly as the deployable unit.
  RequireMembership(service, assemblyId);
  var stored = service.Retrieve("pluginassembly", assemblyId, new ColumnSet("content"));
  Require(Convert.FromBase64String(stored.GetAttributeValue<string>("content")).SequenceEqual(bytes), "stored signed assembly bytes");
  string hash; using (var sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
  File.WriteAllText(outputPath, JsonConvert.SerializeObject(new { environmentUrl = "https://org97063a46.crm.dynamics.com", solution = Solution, assemblyId, pluginId, apiId, assembly = identity.FullName, sha256 = hash, customApi = Api, executePrivilege = Privilege, sandbox = true, siteDeployed = false }, Formatting.Indented));
  Console.WriteLine("UAT read-only coverage time adapter registered; manifest saved. No business records changed.");
 }
}
