// Administrative registration only. No business table/schema/flow changes.
using System;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Oiac.Engage.SiteActivityLog;

public static class RegisterSiteActivityLogLegacyObservers {
 static readonly Guid UatOrganization=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09");
 static Entity Find(IOrganizationService s,string table,string key,object value,params string[] columns){var q=new QueryExpression(table){ColumnSet=new ColumnSet(columns),TopCount=2};q.Criteria.AddCondition(key,ConditionOperator.Equal,value);var rows=s.RetrieveMultiple(q).Entities;if(rows.Count>1)throw new InvalidOperationException("Ambiguous history registration: "+table);return rows.SingleOrDefault();}
 public static void Apply(IOrganizationService service,Guid assembly,Guid verifiedIntegrationUser,bool enableCapture,bool hostedProofAccepted){
  var who=(WhoAmIResponse)service.Execute(new WhoAmIRequest());if(who.OrganizationId!=UatOrganization)throw new InvalidOperationException("History observers are restricted to the specified OIAC UAT organization.");
  if(verifiedIntegrationUser==Guid.Empty||enableCapture&&!hostedProofAccepted)throw new InvalidOperationException("Verified integration identity and hosted provenance proof required.");
  var identity=service.Retrieve("systemuser",verifiedIntegrationUser,new ColumnSet("systemuserid","applicationid"));if(!identity.Contains("applicationid"))throw new InvalidOperationException("Verified portal integration must be an application user.");
  string typeName="Oiac.Engage.SiteActivityLog.SiteActivityLogLegacyCapturePlugin";var type=Find(service,"plugintype","typename",typeName,"pluginassemblyid");Guid typeId;
  if(type==null){type=new Entity("plugintype");type["typename"]=typeName;type["name"]=typeName;type["friendlyname"]="OIAC portal history observer";type["pluginassemblyid"]=new EntityReference("pluginassembly",assembly);typeId=service.Create(type);}else{if(type.GetAttributeValue<EntityReference>("pluginassemblyid").Id!=assembly)throw new InvalidOperationException("History observer assembly differs.");typeId=type.Id;}
  string config="integrationUser="+verifiedIntegrationUser.ToString("D")+";organization="+UatOrganization.ToString("D");
  foreach(string table in new[]{"mss_meetingreport","mss_events","mss_eventregistration","contact","mss_presscoverage"})foreach(string message in new[]{"Create","Update","Delete"}){
   string name="OIAC History Portal "+table+" "+message;
   var sdkMessage=Find(service,"sdkmessage","name",message,"sdkmessageid");if(sdkMessage==null)throw new InvalidOperationException("SDK message unavailable.");
   var fq=new QueryExpression("sdkmessagefilter"){ColumnSet=new ColumnSet(false),TopCount=2};fq.Criteria.AddCondition("sdkmessageid",ConditionOperator.Equal,sdkMessage.Id);fq.Criteria.AddCondition("primaryobjecttypecode",ConditionOperator.Equal,table);var filters=service.RetrieveMultiple(fq).Entities;if(filters.Count!=1)throw new InvalidOperationException("SDK filter missing or ambiguous: "+table);
   string fields=string.Join(",",SiteActivityLogLegacyCapturePlugin.FieldsFor(table));string filter=message=="Update"?fields:null;
   var step=Find(service,"sdkmessageprocessingstep","name",name,"eventhandler","sdkmessageid","sdkmessagefilterid","stage","mode","configuration","filteringattributes","statecode");Guid id;
   if(step!=null){
    if(step.GetAttributeValue<EntityReference>("eventhandler").Id!=typeId||step.GetAttributeValue<EntityReference>("sdkmessageid").Id!=sdkMessage.Id||step.GetAttributeValue<EntityReference>("sdkmessagefilterid").Id!=filters[0].Id||step.GetAttributeValue<OptionSetValue>("stage").Value!=40||step.GetAttributeValue<OptionSetValue>("mode").Value!=1||step.GetAttributeValue<string>("configuration")!=config||(step.GetAttributeValue<string>("filteringattributes")??"")!=(filter??""))throw new InvalidOperationException("Existing history observer differs: "+name);
    if((step.GetAttributeValue<OptionSetValue>("statecode").Value==0)!=enableCapture)throw new InvalidOperationException("Observer activation requires a separate reviewed enablement operation.");id=step.Id;
   }else{
    step=new Entity("sdkmessageprocessingstep");step["name"]=name;step["eventhandler"]=new EntityReference("plugintype",typeId);step["sdkmessageid"]=new EntityReference("sdkmessage",sdkMessage.Id);step["sdkmessagefilterid"]=new EntityReference("sdkmessagefilter",filters[0].Id);step["stage"]=new OptionSetValue(40);step["mode"]=new OptionSetValue(1);step["rank"]=100;step["supporteddeployment"]=new OptionSetValue(0);step["asyncautodelete"]=false;step["configuration"]=config;if(filter!=null)step["filteringattributes"]=filter;step["statecode"]=new OptionSetValue(enableCapture?0:1);step["statuscode"]=new OptionSetValue(enableCapture?1:2);id=enableCapture?service.Create(step):RegisterSiteActivityLogObservers.CreateDisabledStep(service,step);
   }
   if(message!="Create")Image(service,id,"PreImage",0,fields,message);
   if(message!="Delete")Image(service,id,"PostImage",1,fields,message);
  }
 }
 static void Image(IOrganizationService s,Guid step,string alias,int imageType,string fields,string message){
  string propertyName=message=="Create"?"Id":"Target";
  var q=new QueryExpression("sdkmessageprocessingstepimage"){ColumnSet=new ColumnSet("name","entityalias","imagetype","attributes","messagepropertyname"),TopCount=2};q.Criteria.AddCondition("sdkmessageprocessingstepid",ConditionOperator.Equal,step);q.Criteria.AddCondition("name",ConditionOperator.Equal,alias);var rows=s.RetrieveMultiple(q).Entities;if(rows.Count>1)throw new InvalidOperationException("Duplicate history image.");
  if(rows.Count==1){var existing=rows[0];if(existing.GetAttributeValue<string>("entityalias")!=alias||existing.GetAttributeValue<OptionSetValue>("imagetype").Value!=imageType||existing.GetAttributeValue<string>("attributes")!=fields||existing.GetAttributeValue<string>("messagepropertyname")!=propertyName)throw new InvalidOperationException("History image differs.");return;}
  var image=new Entity("sdkmessageprocessingstepimage");image["name"]=alias;image["entityalias"]=alias;image["imagetype"]=new OptionSetValue(imageType);image["attributes"]=fields;image["messagepropertyname"]=propertyName;image["sdkmessageprocessingstepid"]=new EntityReference("sdkmessageprocessingstep",step);s.Create(image);
 }
}


