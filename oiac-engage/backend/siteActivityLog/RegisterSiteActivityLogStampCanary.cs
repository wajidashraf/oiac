// Administrative-only canary registration. Never invoked by build/test.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.ServiceModel;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
public static class RegisterSiteActivityLogStampCanary {
 const string TypeName="Oiac.Engage.SiteActivityLog.SiteActivityLogContextStampCanaryPlugin";
 static readonly Guid Organization=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09");
 public sealed class Manifest {public int SchemaVersion=1;public Guid OrganizationId;public Guid AssemblyId;public Guid PluginTypeId;public string Marker;public bool Completed;public OwnedStep[] Steps;}
 public sealed class OwnedStep {public Guid Id;public Guid MessageId;public Guid FilterId;public string Name;public string Table;public string Message;public string Fields;}
 static void Require(bool ok,string message){if(!ok)throw new InvalidOperationException(message);}
 static Guid Nonce(string marker){Guid n;Require(marker!=null&&marker.StartsWith("OIAC-HISTORY-CHECK-",StringComparison.Ordinal)&&Guid.TryParseExact(marker.Substring(19),"D",out n)&&n!=Guid.Empty,"A fresh nonempty OIAC-HISTORY-CHECK-<guid> marker is required.");return Guid.ParseExact(marker.Substring(19),"D");}
 static void VerifyOrganization(IOrganizationService s){Require(((WhoAmIResponse)s.Execute(new WhoAmIRequest())).OrganizationId==Organization,"Canary operations are restricted to exact OIAC UAT organization.");}
 static void VerifyAssembly(IOrganizationService s,Guid id){Require(id!=Guid.Empty,"History assembly ID required.");var a=s.Retrieve("pluginassembly",id,new ColumnSet("name","version","isolationmode","sourcetype"));Require(a.Id==id&&a.GetAttributeValue<string>("name")=="Oiac.Engage.SiteActivityLog"&&a.GetAttributeValue<string>("version")=="1.0.0.0"&&a.GetAttributeValue<OptionSetValue>("isolationmode")!=null&&a.GetAttributeValue<OptionSetValue>("isolationmode").Value==2&&a.GetAttributeValue<OptionSetValue>("sourcetype")!=null&&a.GetAttributeValue<OptionSetValue>("sourcetype").Value==0,"Canary requires the approved sandbox/database history assembly.");}
 static Entity Find(IOrganizationService s,string table,string attr,object value,params string[] cols){var q=new QueryExpression(table){ColumnSet=new ColumnSet(cols),TopCount=2};q.Criteria.AddCondition(attr,ConditionOperator.Equal,value);var rows=s.RetrieveMultiple(q).Entities;Require(rows.Count<=1,"Ambiguous canary registration: "+table);return rows.SingleOrDefault();}
 static OwnedStep[] Plan(string marker){string nonce=Nonce(marker).ToString("D");return new[]{new OwnedStep{Table="mss_activitypost",Message="Create",Fields="mss_content",Name="OIAC History Stamp Canary "+nonce+" mss_activitypost Create"}};}
 public static void Configure(IOrganizationService s,Guid assembly,string marker,string manifestPath){
  VerifyOrganization(s);var plan=Plan(marker);Require(!string.IsNullOrWhiteSpace(manifestPath)&&!File.Exists(manifestPath),"Use a fresh ownership manifest path; existing files are never overwritten.");VerifyAssembly(s,assembly);
  var type=Find(s,"plugintype","typename",TypeName,"pluginassemblyid");if(type!=null)Require(type.GetAttributeValue<EntityReference>("pluginassemblyid")!=null&&type.GetAttributeValue<EntityReference>("pluginassemblyid").Id==assembly,"Existing canary type belongs to a different assembly.");Guid typeId=type==null?Guid.NewGuid():type.Id;
  // Resolve and inspect every target before the first registration mutation.
  foreach(var item in plan){Require(Find(s,"sdkmessageprocessingstep","name",item.Name,"sdkmessageprocessingstepid")==null,"Canary marker/name already exists; choose a fresh unique marker.");var message=Find(s,"sdkmessage","name",item.Message,"sdkmessageid");Require(message!=null,"SDK message missing for canary.");var q=new QueryExpression("sdkmessagefilter"){ColumnSet=new ColumnSet(false),TopCount=2};q.Criteria.AddCondition("sdkmessageid",ConditionOperator.Equal,message.Id);q.Criteria.AddCondition("primaryobjecttypecode",ConditionOperator.Equal,item.Table);var filters=s.RetrieveMultiple(q).Entities;Require(filters.Count==1,"SDK canary table/message filter missing or ambiguous.");item.Id=Guid.NewGuid();item.MessageId=message.Id;item.FilterId=filters[0].Id;}
  var manifest=new Manifest{OrganizationId=Organization,AssemblyId=assembly,PluginTypeId=typeId,Marker=marker,Steps=plan};
  // Journal exact preassigned IDs before SDK Create so partial registration can
  // still be cleaned up without selecting any unrelated existing component.
  using(var file=new FileStream(manifestPath,FileMode.CreateNew,FileAccess.Write,FileShare.None))using(var writer=new StreamWriter(file))writer.Write(JsonConvert.SerializeObject(manifest,Formatting.Indented));
  if(type==null){type=new Entity("plugintype",typeId);type["typename"]=TypeName;type["name"]=TypeName;type["friendlyname"]="OIAC temporary marked synchronous provenance stamp";type["pluginassemblyid"]=new EntityReference("pluginassembly",assembly);Require(s.Create(type)==typeId,"Unexpected canary type identity.");}
  foreach(var item in plan){var step=new Entity("sdkmessageprocessingstep",item.Id);step["name"]=item.Name;step["eventhandler"]=new EntityReference("plugintype",typeId);step["sdkmessageid"]=new EntityReference("sdkmessage",item.MessageId);step["sdkmessagefilterid"]=new EntityReference("sdkmessagefilter",item.FilterId);step["stage"]=new OptionSetValue(20);step["mode"]=new OptionSetValue(0);step["rank"]=1000;step["supporteddeployment"]=new OptionSetValue(0);step["asyncautodelete"]=false;step["configuration"]=marker;step["statecode"]=new OptionSetValue(0);step["statuscode"]=new OptionSetValue(1);if(item.Message=="Update")step["filteringattributes"]=item.Fields;Require(s.Create(step)==item.Id,"Unexpected canary step identity.");}
  manifest.Completed=true;File.WriteAllText(manifestPath,JsonConvert.SerializeObject(manifest,Formatting.Indented));Console.WriteLine("One marked synchronous UAT provenance-stamp proof step registered; separate ownership manifest saved. No business records changed.");
 }
 static Entity Existing(IOrganizationService s,string table,Guid id,ColumnSet cols){try{return s.Retrieve(table,id,cols);}catch(FaultException<OrganizationServiceFault> e){if(e.Detail.ErrorCode==-2147220969)return null;throw;}}
 public static void Remove(IOrganizationService s,string manifestPath){
  VerifyOrganization(s);var text=File.ReadAllText(manifestPath);Require(text.Length<=16384,"Invalid canary ownership manifest.");var m=JsonConvert.DeserializeObject<Manifest>(text);Require(m!=null&&m.SchemaVersion==1&&m.OrganizationId==Organization&&m.AssemblyId!=Guid.Empty&&m.PluginTypeId!=Guid.Empty,"Invalid canary ownership manifest.");var expected=Plan(m.Marker);Require(m.Steps!=null&&m.Steps.Length==expected.Length&&m.Steps.All(x=>x!=null)&&m.Steps.Select(x=>x.Id).Distinct().Count()==expected.Length&&m.Steps.Select(x=>x.Name).Distinct().Count()==expected.Length,"Invalid canary owned-step inventory.");
  VerifyAssembly(s,m.AssemblyId);var type=s.Retrieve("plugintype",m.PluginTypeId,new ColumnSet("typename","pluginassemblyid"));Require(type.GetAttributeValue<string>("typename")==TypeName&&type.GetAttributeValue<EntityReference>("pluginassemblyid")!=null&&type.GetAttributeValue<EntityReference>("pluginassemblyid").Id==m.AssemblyId,"Canary type/assembly ownership changed.");var deletions=new List<Guid>();
  // Validate ALL owned components before deleting the first step.
  foreach(var item in m.Steps){Require(item!=null&&item.Id!=Guid.Empty&&item.MessageId!=Guid.Empty&&item.FilterId!=Guid.Empty&&expected.Any(planned=>planned.Name==item.Name&&planned.Table==item.Table&&planned.Message==item.Message&&planned.Fields==item.Fields),"Canary step inventory differs from the fixed plan.");var e=Existing(s,"sdkmessageprocessingstep",item.Id,new ColumnSet("name","eventhandler","sdkmessageid","sdkmessagefilterid","configuration","stage","mode","filteringattributes","statecode"));if(e==null)continue;
   Require(e.GetAttributeValue<string>("name")==item.Name&&e.GetAttributeValue<string>("configuration")==m.Marker&&e.GetAttributeValue<EntityReference>("eventhandler")!=null&&e.GetAttributeValue<EntityReference>("eventhandler").Id==m.PluginTypeId&&e.GetAttributeValue<EntityReference>("sdkmessageid")!=null&&e.GetAttributeValue<EntityReference>("sdkmessageid").Id==item.MessageId&&e.GetAttributeValue<EntityReference>("sdkmessagefilterid")!=null&&e.GetAttributeValue<EntityReference>("sdkmessagefilterid").Id==item.FilterId&&e.GetAttributeValue<OptionSetValue>("stage")!=null&&e.GetAttributeValue<OptionSetValue>("stage").Value==20&&e.GetAttributeValue<OptionSetValue>("mode")!=null&&e.GetAttributeValue<OptionSetValue>("mode").Value==0&&(e.GetAttributeValue<string>("filteringattributes")??"")==(item.Message=="Update"?item.Fields:""),"Canary step ownership changed; no cleanup performed.");deletions.Add(item.Id);
  }
  foreach(Guid id in deletions)s.Delete("sdkmessageprocessingstep",id);
  Console.WriteLine("Removed "+deletions.Count+" exact owned canary steps. Business records, diagnostics, history rows, assembly and other registrations preserved.");
 }
}



