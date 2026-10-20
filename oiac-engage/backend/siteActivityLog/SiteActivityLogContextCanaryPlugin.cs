using System;
using System.Linq;
using System.Collections.Generic;
using System.Text;
using Microsoft.Xrm.Sdk;

namespace Oiac.Engage.SiteActivityLog {
 // Administrative canary: only a newly marked test record can produce a diagnostic.
 // Asynchronous failure is intentional and never rolls back the business operation.
 public sealed class SiteActivityLogContextCanaryPlugin:IPlugin {
  readonly string marker;
  public SiteActivityLogContextCanaryPlugin(string configuration){Guid nonce;if(configuration==null||!configuration.StartsWith("OIAC-HISTORY-CHECK-",StringComparison.Ordinal)||!Guid.TryParseExact(configuration.Substring(19),"D",out nonce))throw new InvalidPluginExecutionException("A unique history canary marker is required.");marker=configuration;}
  public void Execute(IServiceProvider provider){
   var c=(IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
   if(c.Mode!=1||c.Stage!=40||c.OrganizationId!=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09"))return;
   var images=c.PostEntityImages.Concat(c.PreEntityImages).Select(x=>x.Value);
   if(!images.Any(e=>e.Attributes.Values.OfType<string>().Any(value=>value.StartsWith(marker,StringComparison.Ordinal))))return;
   var portal=c as IPluginExecutionContext2;var p=c.ParentContext;object actor=null;
   if(p!=null)p.InputParameters.TryGetValue("ActorContactId",out actor);
   string message="OIAC_HISTORY_CANARY|org="+c.OrganizationId+"|initiating="+c.InitiatingUserId+"|user="+c.UserId+"|depth="+c.Depth+"|portal="+(portal!=null&&portal.IsPortalsClientCall)+"|actor="+(portal==null?Guid.Empty:portal.PortalsContactId)+"|parent="+(p==null?"none":SafeName(p.MessageName))+"|parentStage="+(p==null?0:p.Stage)+"|parentActor="+(actor is Guid?(Guid)actor:Guid.Empty)+"|pre="+c.PreEntityImages.Contains("PreImage")+"|post="+c.PostEntityImages.Contains("PostImage")+"|operation="+c.OperationId;
   throw new InvalidPluginExecutionException(message+Receipt(c,"self")+Native(c)+DeleteProbe(c)+CoverageProbe(c)+Parents(c));
  }
  static string SafeName(string name){return !string.IsNullOrEmpty(name)&&name.Length<=96&&name.All(ch=>ch>='A'&&ch<='Z'||ch>='a'&&ch<='z'||ch>='0'&&ch<='9'||ch=='_')?name:"invalid";}
  static string CoverageProbe(IPluginExecutionContext c){Guid actor;string result="|portalResolved="+SiteActivityLogPortalActor.TryResolve(c,new Guid("605697c5-69a5-f111-b8dd-002248042536"),SiteActivityLogNativeReceipt.Organization,out actor)+"|coveragePresent="+(c.SharedVariables!=null&&c.SharedVariables.Contains(SiteActivityLogCoverageReceipt.Key))+"|coverageTrusted="+(SiteActivityLogCoverageReceipt.Read(c)!=null)+"|";var p=c.ParentContext;if(p!=null)result+="p0.idMatch="+(p.PrimaryEntityId==c.PrimaryEntityId)+"|p0.tableMatch="+(p.PrimaryEntityName==c.PrimaryEntityName)+"|p0.initMatch="+(p.InitiatingUserId==c.InitiatingUserId)+"|";object raw;if(c.SharedVariables==null||!c.SharedVariables.TryGetValue("Oiac.History.UploadProbe.v1",out raw))return result+"uploadProbe=False|";var r=raw as Entity;if(r==null||r.LogicalName!="oiac_history_upload_probe")return result+"uploadProbe=invalid|";foreach(var kv in r.Attributes)if(kv.Value is bool||kv.Value is int||new[]{"fields","chain"}.Contains(kv.Key))result+="up."+kv.Key+"="+kv.Value+"|";return result;}
  static string Native(IPluginExecutionContext c){object raw;if(c.SharedVariables==null||!c.SharedVariables.TryGetValue(SiteActivityLogNativeReceipt.Key,out raw))return "|nativePresent=False|";var r=raw as Entity;return "|nativePresent=True|nativeTrusted="+(SiteActivityLogNativeReceipt.Read(c)!=null)+"|nativeEntity="+(r!=null&&r.LogicalName==SiteActivityLogNativeReceipt.EntityName)+"|nativeRecordMatch="+(r!=null&&r.Contains("record")&&r["record"] is Guid&&(Guid)r["record"]==c.PrimaryEntityId)+"|nativeInitiatingMatch="+(r!=null&&r.Contains("initiating")&&r["initiating"] is Guid&&(Guid)r["initiating"]==c.InitiatingUserId)+"|";}
  static string DeleteProbe(IPluginExecutionContext c){object raw;if(c.SharedVariables==null||!c.SharedVariables.TryGetValue("Oiac.History.DeleteProbe.v1",out raw))return "|deleteProbe=False|";var r=raw as Entity;if(r==null||r.LogicalName!="oiac_history_delete_probe")return "|deleteProbe=invalid|";string result="|deleteProbe=True";foreach(string key in new[]{"sourceEmpty","targetMatches","depth","parentStage","parentMode","parentEmpty","userMatches","initiatingMatches","correlationMatches"}){object v;if(r.Attributes.TryGetValue(key,out v)&&(v is bool||v is int))result+="|dp."+key+"="+v;}return result+"|dp.parentMessage="+SafeName(r.GetAttributeValue<string>("parentMessage"))+"|dp.chain="+r.GetAttributeValue<string>("chain")+"|";}
  static string Receipt(IPluginExecutionContext context,string prefix){
   bool present=context.SharedVariables!=null&&context.SharedVariables.Contains(SiteActivityLogStampReceipt.Key);if(!present)return "|"+prefix+".receiptPresent=False|";
   var r=SiteActivityLogStampReceipt.Read(context);if(r==null)return "|"+prefix+".receiptPresent=True|"+prefix+".receiptShapeValid=False|";
   return "|"+prefix+".receiptPresent=True|"+prefix+".receiptShapeValid=True|"+prefix+".receiptActor="+(Guid)r["actor"]+"|"+prefix+".receiptApi="+(string)r["api"]+"|"+prefix+".receiptCommand="+(string)r["command"]+"|"+prefix+".receiptSite="+(Guid)r["site"]+"|"+prefix+".receiptContextMatch="+((Guid)r["organization"]==context.OrganizationId&&(Guid)r["user"]==context.UserId&&(Guid)r["correlation"]==context.CorrelationId)+"|";
  }
  static string Parents(IPluginExecutionContext child){
   var output=new StringBuilder();var seen=new List<IPluginExecutionContext>();var parent=child.ParentContext;bool cycle=false;
   while(parent!=null&&seen.Count<8){
    if(seen.Any(previous=>object.ReferenceEquals(previous,parent))){cycle=true;break;}
    string prefix="|p"+seen.Count.ToString(System.Globalization.CultureInfo.InvariantCulture)+".";seen.Add(parent);object rawActor;parent.InputParameters.TryGetValue("ActorContactId",out rawActor);
    output.Append(prefix+"name="+SafeName(parent.MessageName));
    output.Append(prefix+"stage="+parent.Stage);output.Append(prefix+"mode="+parent.Mode);output.Append(prefix+"depth="+parent.Depth);
    output.Append(prefix+"orgMatch="+(parent.OrganizationId==child.OrganizationId));output.Append(prefix+"userMatch="+(parent.UserId==child.UserId));output.Append(prefix+"correlationMatch="+(parent.CorrelationId==child.CorrelationId));
    output.Append(prefix+"actor="+(rawActor is Guid?(Guid)rawActor:Guid.Empty));output.Append(Receipt(parent,"p"+(seen.Count-1).ToString(System.Globalization.CultureInfo.InvariantCulture)));output.Append(Native(parent));parent=parent.ParentContext;
   }
   if(parent!=null&&seen.Any(previous=>object.ReferenceEquals(previous,parent)))cycle=true;
   output.Append("|parentChainCount="+seen.Count+"|parentChainCycle="+cycle+"|parentChainTruncated="+(parent!=null&&!cycle)+"|");return output.ToString();
  }
 }
}



