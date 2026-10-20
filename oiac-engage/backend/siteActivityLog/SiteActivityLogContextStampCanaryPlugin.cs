using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
namespace Oiac.Engage.SiteActivityLog {
 // Temporary marker-scoped proof only. Capture does not consume this receipt.
 public sealed class SiteActivityLogContextStampCanaryPlugin:IPlugin {
  readonly string marker;
  public SiteActivityLogContextStampCanaryPlugin(string configuration){Guid nonce;if(configuration!=null&&configuration.StartsWith("OIAC-HISTORY-CHECK-",StringComparison.Ordinal)&&Guid.TryParseExact(configuration.Substring(19),"D",out nonce)&&nonce!=Guid.Empty)marker=configuration;}
  public void Execute(IServiceProvider provider){
   // Provenance diagnostics must never break or mutate a business save.
   try{
    var c=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
    if(c.MessageName=="Delete"){DeleteProbe(c);return;}
    if(marker==null||c.Stage!=20||c.Mode!=0||c.MessageName!="Create"||c.PrimaryEntityName!="mss_activitypost"||c.OrganizationId!=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09")||c.UserId==Guid.Empty||c.CorrelationId==Guid.Empty||c.SharedVariables==null||c.SharedVariables.Contains(SiteActivityLogStampReceipt.Key))return;
    object raw;var target=c.InputParameters.TryGetValue("Target",out raw)?raw as Entity:null;
    if(target==null||target.LogicalName!="mss_activitypost"||target.Id==Guid.Empty)return;var content=target.GetAttributeValue<string>("mss_content");if(content==null||!content.StartsWith(marker,StringComparison.Ordinal))return;
    var seen=new List<IPluginExecutionContext>();var parent=c.ParentContext;
    while(parent!=null&&seen.Count<8){
     if(seen.Any(previous=>object.ReferenceEquals(previous,parent))||parent.OrganizationId!=c.OrganizationId||parent.UserId!=c.UserId||parent.CorrelationId!=c.CorrelationId||parent.Mode!=0)return;seen.Add(parent);
     if(parent.MessageName=="mss_ActivityChannelCommand"){
      object actor,command;if(parent.Stage!=30||!parent.InputParameters.TryGetValue("ActorContactId",out actor)||!(actor is Guid)||(Guid)actor==Guid.Empty||!parent.InputParameters.TryGetValue("Command",out command)||!(command is string)||(string)command!="post")return;
      var portal=c as IPluginExecutionContext2;if(portal!=null&&portal.IsPortalsClientCall&&(portal.PortalsContactId==Guid.Empty||portal.PortalsContactId!=(Guid)actor))return;
      var receipt=new Entity(SiteActivityLogStampReceipt.EntityName);receipt["schema"]=1;receipt["actor"]=(Guid)actor;receipt["api"]="mss_ActivityChannelCommand";receipt["command"]="post";receipt["site"]=SiteActivityLogReadPlugin.Site;receipt["organization"]=c.OrganizationId;receipt["user"]=c.UserId;receipt["correlation"]=c.CorrelationId;receipt["record"]=target.Id;c.SharedVariables.Add(SiteActivityLogStampReceipt.Key,receipt);return;
     }
     // Only the same native row's synchronous pipeline wrapper may precede API.
     if(parent.MessageName!=c.MessageName||parent.PrimaryEntityName!=c.PrimaryEntityName||parent.Stage!=30||(parent.PrimaryEntityId!=Guid.Empty&&parent.PrimaryEntityId!=target.Id))return;parent=parent.ParentContext;
    }
   }catch{ /* Temporary observation must leave all business behavior unchanged. */ }
  }
  void DeleteProbe(IPluginExecutionContext c){
   if(marker==null||c.Stage!=20||c.Mode!=0||c.PrimaryEntityName!="mss_activitypost"||c.OrganizationId!=SiteActivityLogNativeReceipt.Organization||c.SharedVariables==null||!c.PreEntityImages.Contains("PreImage"))return;
   string content=c.PreEntityImages["PreImage"].GetAttributeValue<string>("mss_content");if(content==null||!content.StartsWith(marker,StringComparison.Ordinal))return;
   object raw;var target=c.InputParameters.TryGetValue("Target",out raw)?raw as EntityReference:null;var p=c.ParentContext;var probe=new Entity("oiac_history_delete_probe");probe["sourceEmpty"]=c.PrimaryEntityId==Guid.Empty;probe["targetMatches"]=target!=null&&target.Id==c.PreEntityImages["PreImage"].Id;probe["depth"]=c.Depth;probe["parentStage"]=p==null?0:p.Stage;probe["parentMode"]=p==null?-1:p.Mode;probe["parentMessage"]=p==null?"none":p.MessageName;probe["parentEmpty"]=p==null||p.PrimaryEntityId==Guid.Empty;probe["userMatches"]=p!=null&&p.UserId==c.UserId;probe["initiatingMatches"]=p!=null&&p.InitiatingUserId==c.InitiatingUserId;probe["correlationMatches"]=p!=null&&p.CorrelationId==c.CorrelationId;
   var seen=new List<IPluginExecutionContext>();string chain="";
   while(p!=null&&seen.Count<8&&!seen.Any(x=>object.ReferenceEquals(x,p))){seen.Add(p);object t,a,k;p.InputParameters.TryGetValue("Target",out t);p.InputParameters.TryGetValue("ActorContactId",out a);p.InputParameters.TryGetValue("Command",out k);var er=t as EntityReference;var en=t as Entity;string name=p.MessageName;bool safe=!string.IsNullOrEmpty(name)&&name.Length<=96&&name.All(ch=>char.IsLetterOrDigit(ch)||ch=='_');chain+="p"+seen.Count+":"+(safe?name:"invalid")+",s"+p.Stage+",m"+p.Mode+",id"+(p.PrimaryEntityId==c.PrimaryEntityId)+",table"+(p.PrimaryEntityName==c.PrimaryEntityName)+",target"+(t==null?"none":er!=null?"reference":en!=null?"entity":"other")+",targetId"+(er!=null&&er.Id==c.PrimaryEntityId||en!=null&&en.Id==c.PrimaryEntityId)+",user"+(p.UserId==c.UserId)+",init"+(p.InitiatingUserId==c.InitiatingUserId)+",corr"+(p.CorrelationId==c.CorrelationId)+",actor"+(a is Guid&&(Guid)a!=Guid.Empty)+",remove"+(k is string&&(string)k=="remove")+";";p=p.ParentContext;}
   probe["chain"]=chain;c.SharedVariables["Oiac.History.DeleteProbe.v1"]=probe;
  }
 }
 internal static class SiteActivityLogStampReceipt {
  internal const string Key="Oiac.Engage.SiteActivityLog.NativeProvenance.SharedVariableReceipt.v1",EntityName="oiac_history_native_provenance_receipt_v1";
  internal static Entity Read(IPluginExecutionContext context){
   object raw;if(context.SharedVariables==null||!context.SharedVariables.TryGetValue(Key,out raw))return null;var r=raw as Entity;var fields=new[]{"schema","actor","api","command","site","organization","user","correlation","record"};
   if(r==null||r.LogicalName!=EntityName||r.Attributes.Count!=fields.Length||fields.Any(k=>!r.Contains(k))||!(r["schema"] is int)||(int)r["schema"]!=1||!(r["api"] is string)||(string)r["api"]!="mss_ActivityChannelCommand"||!(r["command"] is string)||(string)r["command"]!="post"||new[]{"actor","site","organization","user","correlation","record"}.Any(k=>!(r[k] is Guid)||(Guid)r[k]==Guid.Empty)||(Guid)r["site"]!=SiteActivityLogReadPlugin.Site)return null;return r;
  }
 }
}
