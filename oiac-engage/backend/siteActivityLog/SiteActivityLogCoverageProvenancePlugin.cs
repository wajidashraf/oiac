using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;
namespace Oiac.Engage.SiteActivityLog {
 // Observe the existing upload API's final verified state clear. Never change
 // Target, call Dataverse, or affect the existing upload result.
 public sealed class SiteActivityLogCoverageProvenancePlugin:IPlugin {
  public void Execute(IServiceProvider provider){try{
   var c=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
   if(c.Stage!=20||c.Mode!=0||c.Depth<2||!SiteActivityLogCoverageReceipt.Context(c)||c.SharedVariables==null||c.SharedVariables.Contains(SiteActivityLogCoverageReceipt.Key))return;
   object raw;var target=c.InputParameters.TryGetValue("Target",out raw)?raw as Entity:null;
   if(!SiteActivityLogCoverageReceipt.ClearTarget(c,target))return;
   if(!c.PreEntityImages.Contains("PreImage"))return;
   var transfer=SiteActivityLogCoverageReceipt.Transfer(c.PreEntityImages["PreImage"]);var seen=new List<IPluginExecutionContext>();var parent=c.ParentContext;
   while(parent!=null&&seen.Count<8){
    if(seen.Any(p=>object.ReferenceEquals(p,parent))||parent.Mode!=0||parent.OrganizationId!=c.OrganizationId||parent.UserId!=c.UserId||parent.InitiatingUserId!=c.InitiatingUserId||parent.CorrelationId!=c.CorrelationId)return;seen.Add(parent);
    if(parent.MessageName=="mss_CoverageFileCommand"){
     object actor,command,payload;if(parent.Stage!=30||!parent.InputParameters.TryGetValue("ActorContactId",out actor)||!(actor is Guid)||(Guid)actor==Guid.Empty||!parent.InputParameters.TryGetValue("Command",out command)||!(command is string)||(string)command!="commit"||!parent.InputParameters.TryGetValue("Payload",out payload)||!(payload is string))return;
     var p=Codec.Parse((string)payload);Codec.Keys(p,"id","sessionId");Guid id,session;
     if(!(p["id"] is string)||!(p["sessionId"] is string)||!Guid.TryParseExact((string)p["id"],"D",out id)||id!=c.PrimaryEntityId||!Guid.TryParseExact((string)p["sessionId"],"D",out session)||session==Guid.Empty||!SiteActivityLogCoverageReceipt.Matches(transfer,(Guid)actor,id,session))return;
     var portal=c as IPluginExecutionContext2;if(portal!=null&&portal.IsPortalsClientCall&&portal.PortalsContactId!=(Guid)actor)return;
     var receipt=new Entity(SiteActivityLogCoverageReceipt.EntityName);receipt["schema"]=1;receipt["actor"]=(Guid)actor;receipt["api"]="mss_CoverageFileCommand";receipt["command"]="commit";receipt["site"]=SiteActivityLogReadPlugin.Site;receipt["organization"]=c.OrganizationId;receipt["user"]=c.UserId;receipt["initiating"]=c.InitiatingUserId;receipt["correlation"]=c.CorrelationId;receipt["record"]=c.PrimaryEntityId;receipt["table"]=c.PrimaryEntityName;receipt["message"]=c.MessageName;receipt["session"]=session;c.SharedVariables.Add(SiteActivityLogCoverageReceipt.Key,receipt);return;
    }
    if(parent.Stage!=30||parent.MessageName!="Update"||parent.PrimaryEntityName!=c.PrimaryEntityName||parent.PrimaryEntityId!=c.PrimaryEntityId)return;parent=parent.ParentContext;
   }
  }catch{ /* A missing history receipt cannot fail the original upload. */ }}
 }
 internal static class SiteActivityLogCoverageReceipt {
  internal const string Key="Oiac.Engage.SiteActivityLog.CoverageUpload.Provenance.v1",EntityName="oiac_history_coverage_upload_receipt_v1";
  internal static bool ClearTarget(IPluginExecutionContext c,Entity target){
   if(target==null||target.LogicalName!=c.PrimaryEntityName||target.Id!=c.PrimaryEntityId||!target.Contains("mss_coverageuploadstate"))return false;
   var value=target["mss_coverageuploadstate"];if(value!=null&&(!(value is string)||(string)value!=""))return false;
   foreach(var a in target.Attributes){if(a.Key=="mss_coverageuploadstate")continue;if(a.Key=="mss_presscoverageid"){if(!(a.Value is Guid)||(Guid)a.Value!=c.PrimaryEntityId)return false;continue;}if(a.Key=="modifiedon"){if(!(a.Value is DateTime))return false;continue;}if(a.Key=="modifiedby"||a.Key=="modifiedonbehalfby"){var user=a.Value as EntityReference;if(a.Value!=null&&(user==null||user.LogicalName!="systemuser"||user.Id==Guid.Empty))return false;continue;}return false;}
   return true;
  }
  [DataContract]internal sealed class Data {[DataMember]public string Coverage{get;set;}[DataMember]public string Actor{get;set;}[DataMember]public string Session{get;set;}[DataMember]public string Phase{get;set;}[DataMember]public string Name{get;set;}[DataMember]public int Size{get;set;}}
  internal static Data Transfer(Entity before){var json=before.GetAttributeValue<string>("mss_coverageuploadstate");if(string.IsNullOrEmpty(json)||json.Length>65536)throw new InvalidOperationException();using(var stream=new MemoryStream(Encoding.UTF8.GetBytes(json)))return (Data)new DataContractJsonSerializer(typeof(Data)).ReadObject(stream);}
  internal static bool Matches(Data data,Guid actor,Guid record,Guid session){Guid a,r,s;return data!=null&&data.Phase=="committing"&&Guid.TryParseExact(data.Actor,"D",out a)&&a==actor&&Guid.TryParseExact(data.Coverage,"D",out r)&&r==record&&Guid.TryParseExact(data.Session,"D",out s)&&s==session&&data.Size>=1&&data.Size<=10485760&&!string.IsNullOrWhiteSpace(data.Name)&&data.Name.Length<=255;}
  internal static bool Context(IPluginExecutionContext c){return c!=null&&c.OrganizationId==SiteActivityLogNativeReceipt.Organization&&c.PrimaryEntityName=="mss_presscoverage"&&c.PrimaryEntityId!=Guid.Empty&&c.MessageName=="Update"&&c.UserId!=Guid.Empty&&c.InitiatingUserId!=Guid.Empty&&c.CorrelationId!=Guid.Empty;}
  internal static Entity Read(IPluginExecutionContext c){try{
   if(!Context(c)||c.Stage!=40||c.Mode!=1||c.SharedVariables==null)return null;object raw;if(!c.SharedVariables.TryGetValue(Key,out raw))return null;var r=raw as Entity;
   var fields=new[]{"schema","actor","api","command","site","organization","user","initiating","correlation","record","table","message","session"};
   if(r==null||r.LogicalName!=EntityName||r.Attributes.Count!=fields.Length||fields.Any(k=>!r.Contains(k))||!(r["schema"] is int)||(int)r["schema"]!=1||new[]{"actor","site","organization","user","initiating","correlation","record","session"}.Any(k=>!(r[k] is Guid)||(Guid)r[k]==Guid.Empty)||new[]{"api","command","table","message"}.Any(k=>!(r[k] is string)))return null;
   if((Guid)r["site"]!=SiteActivityLogReadPlugin.Site||(Guid)r["organization"]!=c.OrganizationId||(Guid)r["user"]!=c.UserId||(Guid)r["initiating"]!=c.InitiatingUserId||(Guid)r["correlation"]!=c.CorrelationId||(Guid)r["record"]!=c.PrimaryEntityId||(string)r["api"]!="mss_CoverageFileCommand"||(string)r["command"]!="commit"||(string)r["table"]!=c.PrimaryEntityName||(string)r["message"]!=c.MessageName)return null;
   var portal=c as IPluginExecutionContext2;if(portal!=null&&portal.IsPortalsClientCall&&portal.PortalsContactId!=(Guid)r["actor"])return null;return r;
  }catch{return null;}}
 }
}
