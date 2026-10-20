using System;
using System.Collections.Generic;
using System.Runtime.Remoting.Messaging;
using System.Runtime.Remoting.Proxies;
using Microsoft.Xrm.Sdk;
using Oiac.Engage.SiteActivityLog;
class SiteActivityLogCoverageProvenanceTests {
 static readonly Guid Actor=Guid.NewGuid(),Record=Guid.NewGuid(),Session=Guid.NewGuid(),User=Guid.NewGuid(),Correlation=Guid.NewGuid();
 static void Check(bool v,string message){if(!v)throw new Exception(message);}
 class C:RealProxy {
  internal Dictionary<string,object> V=new Dictionary<string,object>();internal ParameterCollection Input=new ParameterCollection(),Shared=new ParameterCollection();internal EntityImageCollection Pre=new EntityImageCollection();
  internal C():base(typeof(IPluginExecutionContext2)){V["OrganizationId"]=SiteActivityLogNativeReceipt.Organization;V["UserId"]=User;V["InitiatingUserId"]=User;V["CorrelationId"]=Correlation;V["PrimaryEntityName"]="mss_presscoverage";V["PrimaryEntityId"]=Record;V["MessageName"]="Update";V["Depth"]=2;V["Stage"]=20;V["Mode"]=0;}
  internal IPluginExecutionContext2 Proxy{get{return (IPluginExecutionContext2)GetTransparentProxy();}}
  public override IMessage Invoke(IMessage m){var call=(IMethodCallMessage)m;string key=call.MethodName.Substring(4);object value=null;if(key=="InputParameters")value=Input;else if(key=="SharedVariables")value=Shared;else if(key=="PreEntityImages")value=Pre;else V.TryGetValue(key,out value);if(value==null){var type=((System.Reflection.MethodInfo)call.MethodBase).ReturnType;if(type.IsValueType)value=Activator.CreateInstance(type);}return new ReturnMessage(value,null,0,call.LogicalCallContext,call);}
 }
 class Provider:IServiceProvider {readonly C c;internal int Unexpected;internal Provider(C context){c=context;}public object GetService(Type type){if(type==typeof(IPluginExecutionContext))return c.Proxy;Unexpected++;throw new Exception("No SDK calls allowed");}}
 static string State(Guid session){return "{\"Coverage\":\""+Record+"\",\"Actor\":\""+Actor+"\",\"Session\":\""+session+"\",\"Phase\":\"committing\",\"Name\":\"test.pdf\",\"Size\":622,\"Token\":\"private-token-never-copy\"}";}
 static C Fixture(out C parent){var c=new C();parent=new C();parent.V["MessageName"]="mss_CoverageFileCommand";parent.V["Stage"]=30;parent.Input["ActorContactId"]=Actor;parent.Input["Command"]="commit";parent.Input["Payload"]="{\"id\":\""+Record+"\",\"sessionId\":\""+Session+"\"}";c.V["ParentContext"]=parent.Proxy;var target=new Entity("mss_presscoverage",Record);target["mss_coverageuploadstate"]=null;c.Input["Target"]=target;var before=new Entity("mss_presscoverage",Record);before["mss_coverageuploadstate"]=State(Session);c.Pre["PreImage"]=before;return c;}
 static void Stamp(C c){var provider=new Provider(c);new SiteActivityLogCoverageProvenancePlugin().Execute(provider);Check(provider.Unexpected==0,"sync provenance made an SDK call");}
 static int Main(){try{
  C metadataParent;var metadata=Fixture(out metadataParent);var decorated=(Entity)metadata.Input["Target"];decorated["mss_coverageuploadstate"]="";decorated["mss_presscoverageid"]=Record;decorated["modifiedon"]=DateTime.UtcNow;decorated["modifiedby"]=new EntityReference("systemuser",User);decorated["modifiedonbehalfby"]=null;Stamp(metadata);Check(metadata.Shared.Contains(SiteActivityLogCoverageReceipt.Key),"observed platform-normalized empty state plus audit fields must stamp final upload");
  metadata=Fixture(out metadataParent);((Entity)metadata.Input["Target"])["modifiedby"]="forged";Stamp(metadata);Check(metadata.Shared.Count==0,"invalid platform audit field type rejected");
  C parent;var c=Fixture(out parent);Stamp(c);Check(c.Shared.Contains(SiteActivityLogCoverageReceipt.Key),"verified final clear needs receipt");var receipt=(Entity)c.Shared[SiteActivityLogCoverageReceipt.Key];Check(receipt.Attributes.Count==13&&!receipt.Contains("Token")&&!receipt.Contains("Name")&&!receipt.Contains("Payload"),"receipt must exclude upload secrets and file data");
  c.V["Stage"]=40;c.V["Mode"]=1;parent.V["MessageName"]="Update";parent.V["Mode"]=1;parent.Input["ActorContactId"]=Guid.NewGuid();Check(SiteActivityLogCoverageReceipt.Read(c.Proxy)!=null,"self receipt must survive observed rewritten async ancestry");
  var after=new Entity("mss_presscoverage",Record);after["mss_coveragefile"]=Guid.NewGuid();after["mss_coveragefile_name"]="test.pdf";Guid actor;
  Check(SiteActivityLogLegacyCapturePlugin.TryCoverageCommit(c.Proxy,Guid.NewGuid(),SiteActivityLogNativeReceipt.Organization,c.Pre["PreImage"],after,out actor)&&actor==Actor,"terminal upload capture must use bound self receipt, not rewritten API parents or portal app principal");
  receipt["record"]=Guid.NewGuid();Check(SiteActivityLogCoverageReceipt.Read(c.Proxy)==null,"different record replay rejected");receipt["record"]=Record;
  receipt["correlation"]=Guid.NewGuid();Check(SiteActivityLogCoverageReceipt.Read(c.Proxy)==null,"different correlation rejected");receipt["correlation"]=Correlation;
  receipt["Token"]="private";Check(SiteActivityLogCoverageReceipt.Read(c.Proxy)==null,"extra secret field rejected");receipt.Attributes.Remove("Token");
  c.Pre["PreImage"]["mss_coverageuploadstate"]=State(Guid.NewGuid());Check(!SiteActivityLogLegacyCapturePlugin.TryCoverageCommit(c.Proxy,Guid.NewGuid(),SiteActivityLogNativeReceipt.Organization,c.Pre["PreImage"],after,out actor),"different transfer session rejected");c.Pre["PreImage"]["mss_coverageuploadstate"]=State(Session);
  after["mss_coveragefile_name"]="other.pdf";Check(!SiteActivityLogLegacyCapturePlugin.TryCoverageCommit(c.Proxy,Guid.NewGuid(),SiteActivityLogNativeReceipt.Organization,c.Pre["PreImage"],after,out actor),"different committed file rejected");after["mss_coveragefile_name"]="test.pdf";
  c.Shared.Clear();parent.Shared[SiteActivityLogCoverageReceipt.Key]=receipt;Check(SiteActivityLogCoverageReceipt.Read(c.Proxy)==null,"ancestor-only receipt rejected");c.Shared[SiteActivityLogCoverageReceipt.Key]="forged tag";Check(SiteActivityLogCoverageReceipt.Read(c.Proxy)==null,"untyped client stamp rejected");
  c=Fixture(out parent);parent.Input["Command"]="chunk";Stamp(c);Check(c.Shared.Count==0,"chunk must not stamp upload success");
  c=Fixture(out parent);parent.Input["ActorContactId"]=Guid.NewGuid();Stamp(c);Check(c.Shared.Count==0,"transfer actor mismatch rejected");
  c=Fixture(out parent);parent.V["UserId"]=Guid.NewGuid();Stamp(c);Check(c.Shared.Count==0,"native principal mismatch rejected");
  c=Fixture(out parent);c.V["ParentContext"]=null;Stamp(c);Check(c.Shared.Count==0,"direct arbitrary state clear rejected");
  c=Fixture(out parent);((Entity)c.Input["Target"])["mss_summary"]="unrelated";Stamp(c);Check(c.Shared.Count==0,"mixed business changes cannot become an upload receipt");
  c=Fixture(out parent);c.V["IsPortalsClientCall"]=true;c.V["PortalsContactId"]=Guid.NewGuid();Stamp(c);Check(c.Shared.Count==0,"actual portal actor mismatch rejected");
  Console.WriteLine("PASS terminal coverage sync provenance/no SDK calls; async self receipt; file/session binding; actor/record/correlation/principal/forgery/chunk/mixed-change negatives.");return 0;
 }catch(Exception e){Console.Error.WriteLine("FAIL "+e.Message);return 1;}}
}
