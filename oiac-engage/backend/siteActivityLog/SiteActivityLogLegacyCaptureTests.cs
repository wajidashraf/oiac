using System;
using System.Collections.Generic;
using System.Runtime.Remoting.Messaging;
using System.Runtime.Remoting.Proxies;
using Microsoft.Xrm.Sdk;
using Oiac.Engage.SiteActivityLog;

class SiteActivityLogLegacyCaptureTests {
 static int checks;
 static readonly Guid Actor=Guid.NewGuid(),Other=Guid.NewGuid(),Id=Guid.NewGuid(),Operation=Guid.NewGuid();
 static readonly DateTime When=new DateTime(2026,10,19,10,0,0,DateTimeKind.Utc);
 static Entity Project(string table,string message,Entity before,Entity after){return SiteActivityLogLegacyCapturePlugin.Project(table,Id,message,Actor,before,after,Operation,When);}
 static void Check(bool value,string label){checks++;if(!value)throw new Exception(label);}
 static int Choice(Entity row,string field){return row.GetAttributeValue<OptionSetValue>(field).Value;}
 static int Main(){try{Run();return 0;}catch(Exception e){Console.WriteLine("FAIL "+e.Message);return 1;}}
 static void Run(){
  var report=new Entity("mss_meetingreport",Id);report["mss_subject"]="District briefing";report["mss_reportedby"]=new EntityReference("contact",Other);
  var saved=Project(report.LogicalName,"Create",null,report);
  Check(Choice(saved,"mss_action")==866530002,"report submission semantic action");
  Check(saved.GetAttributeValue<EntityReference>("mss_performedby").Id==Actor,"actual actor instead of record creator");
  Check(saved.GetAttributeValue<string>("mss_recordtitle")=="District briefing","record title snapshot");
  Check(Project(report.LogicalName,"Update",report,report)==null,"no-op update excluded");
  var edited=new Entity(report.LogicalName,Id);edited["mss_subject"]="Revised briefing";
  Check(Choice(Project(report.LogicalName,"Update",report,edited),"mss_action")==866530001,"real edit captured");
  Check(Choice(Project(report.LogicalName,"Delete",report,null),"mss_action")==866530017,"deleted choice and preimage");
  Check(Project(report.LogicalName,"Delete",null,null)==null,"missing delete snapshot not invented");
  var reg=new Entity("mss_eventregistration",Id);reg["mss_registrationstatus"]=new OptionSetValue(1);reg["mss_contact"]=new EntityReference("contact",Other);
  Check(Choice(Project(reg.LogicalName,"Create",null,reg),"mss_action")==866530013,"Join Event captured");
  var oldReg=new Entity(reg.LogicalName,Id);oldReg["mss_registrationstatus"]=new OptionSetValue(2);
  Check(Choice(Project(reg.LogicalName,"Update",oldReg,reg),"mss_action")==866530013,"reactivation is a new join");
  Check(Project(reg.LogicalName,"Update",reg,reg)==null,"already registered retry is no event");
  var contact=new Entity("contact",Actor);contact["firstname"]="A";var changed=new Entity("contact",Actor);changed["firstname"]="B";
  Check(Choice(SiteActivityLogLegacyCapturePlugin.Project("contact",Actor,"Update",Actor,contact,changed,Operation,When),"mss_module")==866530007,"own profile module");
  Check(Choice(Project("contact","Update",contact,changed),"mss_module")==866530006,"editing somebody else is Contacts");
  var credentials=new Entity("contact",Actor);credentials["adx_identity_passwordhash"]="secret";
  Check(Project("contact","Update",new Entity("contact",Actor),credentials)==null,"credentials excluded");
  var coverage=new Entity("mss_presscoverage",Id);coverage["mss_headline"]="Coverage";coverage["mss_isfeatured"]=true;
  var technical=new Entity("mss_presscoverage",Id);technical["mss_headline"]="Coverage";technical["mss_isfeatured"]=true;technical["mss_coverageuploadstate"]="private-token";
  Check(Project(coverage.LogicalName,"Update",coverage,technical)==null,"private file chunks excluded");
  Check(Project("unknown","Create",null,new Entity("unknown",Id))==null,"unknown table excluded");
  var longTitle=new string('t',850);report["mss_subject"]=longTitle;var longEvent=Project(report.LogicalName,"Create",null,report);
  Check(longEvent.GetAttributeValue<string>("mss_recordtitle").Length<=100&&longEvent.GetAttributeValue<string>("mss_summary").Contains(longTitle),"full long title retained in bounded summary");
  var replay=new Entity("mss_meetingreport",Id);replay["mss_subject"]="District briefing";
  Check(saved.GetAttributeValue<string>("mss_eventkey")==Project("mss_meetingreport","Create",null,replay).GetAttributeValue<string>("mss_eventkey"),"replay event identity stable");
  Check(saved.GetAttributeValue<DateTime>("mss_occurredon")==When,"original event time retained");
  PortalWrapperChecks();
  CoverageChecks();
  Console.WriteLine("Passed "+checks+" legacy history projection checks.");
 }
 static void PortalWrapperChecks(){
  var app=Guid.NewGuid();var org=new Guid("3f613eb3-72ea-f011-aa23-6045bd003f09");var correlation=Guid.NewGuid();var source=new Context();var wrapper=new Context();foreach(var c in new[]{source,wrapper}){c.V["OrganizationId"]=org;c.V["UserId"]=app;c.V["InitiatingUserId"]=app;c.V["CorrelationId"]=correlation;c.V["PrimaryEntityName"]="mss_presscoverage";c.V["PrimaryEntityId"]=Id;c.V["MessageName"]="Create";c.V["Depth"]=1;c.V["Mode"]=1;}source.V["Stage"]=40;wrapper.V["Stage"]=30;source.V["IsPortalsClientCall"]=true;source.V["PortalsContactId"]=Actor;source.V["ParentContext"]=wrapper.Proxy;Guid actual;
  Check(SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual)&&actual==Actor,"actual hosted portal self-CRUD async wrapper preserves SDK actor");
  var envelope=new Context();foreach(var key in new[]{"OrganizationId","UserId","InitiatingUserId","CorrelationId","PrimaryEntityId","MessageName","Depth","Mode"})envelope.V[key]=wrapper.V[key];envelope.V["Stage"]=30;envelope.V["PrimaryEntityName"]="none";envelope.V["IsPortalsClientCall"]=true;envelope.V["PortalsContactId"]=Actor;wrapper.V["ParentContext"]=envelope.Proxy;
  Check(SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual)&&actual==Actor,"observed terminal portal transport envelope retains authenticated SDK actor");
  foreach(string mismatch in new[]{"actor","portal","row","parent","correlation"}){if(mismatch=="actor")envelope.V["PortalsContactId"]=Other;if(mismatch=="portal")envelope.V["IsPortalsClientCall"]=false;if(mismatch=="row")envelope.V["PrimaryEntityId"]=Guid.NewGuid();if(mismatch=="parent")envelope.V["ParentContext"]=wrapper.Proxy;if(mismatch=="correlation")envelope.V["CorrelationId"]=Guid.NewGuid();Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"transport envelope rejects "+mismatch);envelope.V["PortalsContactId"]=Actor;envelope.V["IsPortalsClientCall"]=true;envelope.V["PrimaryEntityId"]=Id;envelope.V["ParentContext"]=null;envelope.V["CorrelationId"]=correlation;}wrapper.V["ParentContext"]=null;
  wrapper.Input["ActorContactId"]=Other;Check(SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual)&&actual==Actor,"portal actor comes from SDK self, never ancestor input");
  wrapper.V["PrimaryEntityId"]=Guid.NewGuid();Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"portal wrapper wrong row denied");wrapper.V["PrimaryEntityId"]=Id;wrapper.V["PrimaryEntityName"]="contact";Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"portal wrapper wrong table denied");wrapper.V["PrimaryEntityName"]="mss_presscoverage";wrapper.V["MessageName"]="mss_CoverageFileCommand";Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"native API ancestry is not direct portal CRUD");wrapper.V["MessageName"]="Create";
  wrapper.V["CorrelationId"]=Guid.NewGuid();Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"portal wrapper cross-correlation denied");wrapper.V["CorrelationId"]=correlation;source.V["Depth"]=2;Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"nested portal cascade denied");source.V["Depth"]=1;source.V["IsPortalsClientCall"]=false;Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"forged ancestor actor without SDK portal flag denied");source.V["IsPortalsClientCall"]=true;
  Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,Guid.NewGuid(),org,out actual),"unproven different integration denied");wrapper.V["ParentContext"]=wrapper.Proxy;Check(!SiteActivityLogPortalActor.TryResolve(source.Proxy,app,org,out actual),"portal wrapper cycle denied");
 }
 static void CoverageChecks(){
  // Terminal uploads are covered by the receipt/async-rewrite regression suite.
  var integration=Guid.NewGuid();var org=Guid.NewGuid();
  var root=new Context();root.V["Stage"]=40;root.V["Mode"]=1;root.V["OrganizationId"]=org;root.V["InitiatingUserId"]=integration;root.V["Depth"]=1;root.V["IsPortalsClientCall"]=true;root.V["PortalsContactId"]=Actor;root.V["PrimaryEntityName"]="mss_meetingreport";root.V["MessageName"]="Update";root.V["PreEntityImages"]=new EntityImageCollection();root.V["PostEntityImages"]=new EntityImageCollection();
  bool retry=false;try{new SiteActivityLogLegacyCapturePlugin("integrationUser="+integration+";organization="+org).Execute(new Provider(root.Proxy));}catch(InvalidPluginExecutionException e){retry=e.Status==OperationStatus.Retry;}Check(retry,"missing portal images trigger asynchronous retry");
 }
 class Provider:IServiceProvider {readonly IPluginExecutionContext context;public Provider(IPluginExecutionContext c){context=c;}public object GetService(Type t){return t==typeof(IPluginExecutionContext)?context:null;}}
 class Context:RealProxy {
  public Dictionary<string,object> V=new Dictionary<string,object>();public ParameterCollection Input=new ParameterCollection();public IPluginExecutionContext2 Proxy{get{return (IPluginExecutionContext2)GetTransparentProxy();}}
  public Context():base(typeof(IPluginExecutionContext2)){}
  public override IMessage Invoke(IMessage message){var call=(IMethodCallMessage)message;object value=null;string name=call.MethodName.Substring(4);if(name=="InputParameters")value=Input;else V.TryGetValue(name,out value);if(value==null){var type=((System.Reflection.MethodInfo)call.MethodBase).ReturnType;if(type.IsValueType)value=Activator.CreateInstance(type);}return new ReturnMessage(value,null,0,call.LogicalCallContext,call);}
 }
}

