using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
namespace Oiac.Engage.SiteActivityLog {
 // Authenticates provenance while the synchronous native API ancestry is intact.
 // Never reads/writes Dataverse or modifies Target; unsupported contexts are inert.
 public sealed class SiteActivityLogNativeProvenancePlugin:IPlugin {
  public void Execute(IServiceProvider provider){try{
   var c=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
   if(c.Stage!=20||c.Mode!=0||c.Depth<2||c.OrganizationId!=SiteActivityLogNativeReceipt.Organization||c.UserId==Guid.Empty||c.InitiatingUserId==Guid.Empty||c.CorrelationId==Guid.Empty||c.SharedVariables==null||c.SharedVariables.Contains(SiteActivityLogNativeReceipt.Key))return;
   Guid record=SiteActivityLogNativeReceipt.Target(c);if(record==Guid.Empty)return;
   var seen=new List<IPluginExecutionContext>();var parent=c.ParentContext;
   while(parent!=null&&seen.Count<8){
    if(seen.Any(previous=>object.ReferenceEquals(previous,parent))||parent.Mode!=0||parent.OrganizationId!=c.OrganizationId||parent.InitiatingUserId!=c.InitiatingUserId||parent.CorrelationId!=c.CorrelationId)return;seen.Add(parent);
    string expected=SiteActivityLogNativeReceipt.Api(c.PrimaryEntityName);if(expected==null)return;
    if(parent.MessageName==expected){object actor,command;
     if(parent.Stage!=30||!SiteActivityLogNativeReceipt.ApiPrincipal(c,parent,record)||!parent.InputParameters.TryGetValue("ActorContactId",out actor)||!(actor is Guid)||(Guid)actor==Guid.Empty||!parent.InputParameters.TryGetValue("Command",out command)||!(command is string)||!SiteActivityLogNativeReceipt.Supports(c.PrimaryEntityName,c.MessageName,(string)command))return;
     var portal=c as IPluginExecutionContext2;if(portal!=null&&portal.IsPortalsClientCall&&(portal.PortalsContactId==Guid.Empty||portal.PortalsContactId!=(Guid)actor))return;
     var receipt=new Entity(SiteActivityLogNativeReceipt.EntityName);receipt["schema"]=2;receipt["actor"]=(Guid)actor;receipt["api"]=expected;receipt["command"]=(string)command;receipt["site"]=SiteActivityLogReadPlugin.Site;receipt["organization"]=c.OrganizationId;receipt["user"]=c.UserId;receipt["initiating"]=c.InitiatingUserId;receipt["correlation"]=c.CorrelationId;receipt["record"]=record;receipt["table"]=c.PrimaryEntityName;receipt["message"]=c.MessageName;c.SharedVariables.Add(SiteActivityLogNativeReceipt.Key,receipt);return;
    }
    // A CRUD/cascade on another row must never inherit the caller's action.
    if(parent.UserId!=c.UserId||parent.Stage!=30||parent.MessageName!=c.MessageName||parent.PrimaryEntityName!=c.PrimaryEntityName||SiteActivityLogNativeReceipt.Target(parent)!=record)return;parent=parent.ParentContext;
   }
  }catch{ /* Receipt failure cannot change the existing business save outcome. */ }}
 }
 internal static class SiteActivityLogNativeReceipt {
  internal const string Key="Oiac.Engage.SiteActivityLog.NativeProvenance.SharedVariableReceipt.v2",EntityName="oiac_history_native_provenance_receipt_v2";
  internal static readonly Guid Organization=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09");
  // Observed exact-UAT native Delete switches only the child pipeline to SYSTEM.
  // The exception is bound to the explicit original API row, never cascaded rows.
  internal static bool ApiPrincipal(IPluginExecutionContext source,IPluginExecutionContext api,Guid record){
   if(api.UserId==source.UserId)return true;
   if(source.OrganizationId!=Organization||source.PrimaryEntityName!="mss_activitypost"||source.MessageName!="Delete"||source.UserId!=new Guid("e57ba9cc-171d-48f4-91e8-2fd1aece82f8")||api.UserId!=source.InitiatingUserId||api.UserId==Guid.Empty||api.MessageName!="mss_ActivityChannelCommand")return false;
   object command,payload;if(!api.InputParameters.TryGetValue("Command",out command)||!(command is string)||(string)command!="remove"||!api.InputParameters.TryGetValue("Payload",out payload)||!(payload is string))return false;
   try{var p=Codec.Parse((string)payload);Codec.Keys(p,"id","expectedRowVersion");Guid id;object rawId,version;return p.TryGetValue("id",out rawId)&&rawId is string&&Guid.TryParseExact((string)rawId,"D",out id)&&id==record&&p.TryGetValue("expectedRowVersion",out version)&&version is string&&((string)version).Length>=1&&((string)version).Length<=30&&((string)version)[0]>='1'&&((string)version)[0]<='9'&&((string)version).All(ch=>ch>='0'&&ch<='9');}catch{return false;}
  }
  internal static string Api(string table){return table=="mss_activitypost"||table=="mss_activitycomment"?"mss_ActivityChannelCommand":table=="mss_appointment"?"mss_AppointmentCommand":null;}
  internal static bool Supports(string table,string message,string command){
   if(table=="mss_activitypost")return message=="Create"&&command=="post"||message=="Update"&&(command=="pin"||command=="unpin")||message=="Delete"&&command=="remove";
   if(table=="mss_activitycomment")return message=="Create"&&(command=="comment"||command=="reply")||message=="Delete"&&command=="remove";
   if(table=="mss_appointment")return message=="Create"&&command=="create"||message=="Update"&&(command=="accept"||command=="reschedule");return false;
  }
  internal static Guid Target(IPluginExecutionContext c){object raw;if(!c.InputParameters.TryGetValue("Target",out raw))return Guid.Empty;var e=raw as Entity;var reference=raw as EntityReference;Guid id=Guid.Empty;
   if((c.MessageName=="Create"||c.MessageName=="Update")&&e!=null&&e.LogicalName==c.PrimaryEntityName)id=e.Id;
   if(c.MessageName=="Delete"&&reference!=null&&reference.LogicalName==c.PrimaryEntityName)id=reference.Id;
   return id!=Guid.Empty&&(c.PrimaryEntityId==Guid.Empty&&c.MessageName=="Create"||c.PrimaryEntityId==id)?id:Guid.Empty;
  }
  internal static Entity Read(IPluginExecutionContext c){try{
   if(c.Stage!=40||c.Mode!=1||c.PrimaryEntityId==Guid.Empty||c.OrganizationId!=Organization||c.UserId==Guid.Empty||c.InitiatingUserId==Guid.Empty||c.CorrelationId==Guid.Empty||c.SharedVariables==null)return null;
   object raw;if(!c.SharedVariables.TryGetValue(Key,out raw))return null;var r=raw as Entity;var fields=new[]{"schema","actor","api","command","site","organization","user","initiating","correlation","record","table","message"};
   if(r==null||r.LogicalName!=EntityName||r.Attributes.Count!=fields.Length||fields.Any(k=>!r.Contains(k))||!(r["schema"] is int)||(int)r["schema"]!=2||new[]{"actor","site","organization","user","initiating","correlation","record"}.Any(k=>!(r[k] is Guid)||(Guid)r[k]==Guid.Empty)||new[]{"api","command","table","message"}.Any(k=>!(r[k] is string)))return null;
   if((Guid)r["site"]!=SiteActivityLogReadPlugin.Site||(Guid)r["organization"]!=c.OrganizationId||(Guid)r["user"]!=c.UserId||(Guid)r["initiating"]!=c.InitiatingUserId||(Guid)r["correlation"]!=c.CorrelationId||(Guid)r["record"]!=c.PrimaryEntityId||(string)r["table"]!=c.PrimaryEntityName||(string)r["message"]!=c.MessageName||(string)r["api"]!=Api(c.PrimaryEntityName)||!Supports(c.PrimaryEntityName,c.MessageName,(string)r["command"]))return null;
   var portal=c as IPluginExecutionContext2;if(portal!=null&&portal.IsPortalsClientCall&&(portal.PortalsContactId==Guid.Empty||portal.PortalsContactId!=(Guid)r["actor"]))return null;return r;
  }catch{return null;}}
 }
}
