using System;
using System.Collections.Generic;
using System.Linq;
using System.ServiceModel;
using System.Runtime.Remoting.Proxies;
using System.Runtime.Remoting.Messaging;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Oiac.Engage.Appointments;

public class AppointmentCommandTests {
 static Guid A=Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), B=Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"), C=Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"), Id=Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
 static int passed, failed;
 static void Test(string name, Action action) { try { action(); passed++; Console.WriteLine("PASS " + name); } catch(Exception e) { failed++; Console.WriteLine("FAIL " + name + ": " + e.Message); } }
 static void Assert(bool value,string message) { if(!value) throw new Exception(message); }
 static string Call(Fake s, Guid actor,string command,string payload) { return AppointmentCommandPlugin.Run(s,actor,command,payload); }
 static void Code(string result,string code) { Assert(result.Contains("\"code\":\""+code+"\""),result); }
 static void Ok(string result) { Assert(result.Contains("\"ok\":true"),result); }
 static string Create(string extra="",string date="2026-07-10",string time="09:30",string offset="-240",Guid? recipient=null) { return "{\"id\":\""+Id+"\",\"title\":\"Budget\",\"recipientId\":\""+(recipient??B)+"\",\"meetingFormat\":1,\"preferredDate\":\""+date+"\",\"preferredTime\":\""+time+"\",\"preferredOffsetMinutes\":"+offset+",\"agenda\":\"\""+extra+"}"; }
 static string Change(string fields="\"meetingLink\":\"https://teams.example/meet\"",string version="7") { return "{\"id\":\""+Id+"\",\"expectedRowVersion\":\""+version+"\",\"payload\":{"+fields+"}}"; }
 public static int Main() {
 Test("create stamps actor and UTC",()=>{var s=new Fake(); Ok(Call(s,A,"create",Create())); Assert(((EntityReference)s.Created["mss_requester"]).Id==A,"actor"); Assert((DateTime)s.Created["mss_preferreddate"]==new DateTime(2026,7,10,13,30,0,DateTimeKind.Utc),"ET");});
 Test("anonymous rejected",()=>Code(Call(new Fake(),Guid.Empty,"create",Create()),"unauthenticated"));
 foreach(var field in new[]{"requesterId","ActorContactId","isAdmin","mss_appointmentstatus","ownerid"}) {var f=field;Test("reject forged "+f,()=>Code(Call(new Fake(),A,"create",Create(",\""+f+"\":\"forged\"")),"validation"));}
 Test("self rejected",()=>Code(Call(new Fake(),A,"create",Create(recipient:A)),"validation"));
 Test("disabled recipient rejected",()=>{var s=new Fake();s.Disabled=B; Code(Call(s,A,"create",Create()),"validation");});
 Test("gap rejected",()=>Code(Call(new Fake(),A,"create",Create(date:"2026-03-08",time:"02:30")),"validation"));
 Test("fold without offset rejected",()=>Code(Call(new Fake(),A,"create",Create(date:"2026-11-01",time:"01:30",offset:"null")),"validation"));
 Test("fold second occurrence",()=>{var s=new Fake();Ok(Call(s,A,"create",Create(date:"2026-11-01",time:"01:30",offset:"-300")));Assert((DateTime)s.Created["mss_preferreddate"]==new DateTime(2026,11,1,6,30,0,DateTimeKind.Utc),"fold");});
 Test("invalid date rejected",()=>Code(Call(new Fake(),A,"create",Create(date:"2026-02-30")),"validation"));
 Test("wrong offset rejected",()=>Code(Call(new Fake(),A,"create",Create(offset:"-300")),"validation"));
 Test("requester cannot accept",()=>Code(Call(new Fake(),A,"accept",Change()),"forbidden"));
 Test("stranger cannot accept",()=>Code(Call(new Fake(),C,"accept",Change()),"forbidden"));
 Test("recipient accepts atomically",()=>{var s=new Fake();Ok(Call(s,B,"accept",Change()));Assert(s.UpdateRequest.ConcurrencyBehavior==ConcurrencyBehavior.IfRowVersionMatches,"atomic");Assert(s.UpdateRequest.Target.RowVersion=="7","version");Assert(s.UpdateRequest.Target.Attributes.Count==2,"strict update");});
 Test("stale version conflicts",()=>Code(Call(new Fake(),B,"accept",Change(version:"6")),"conflict"));
 Test("race detected at write",()=>{var s=new Fake();s.Race=true;Code(Call(s,B,"accept",Change()),"conflict");Assert(s.Updated==null,"race mutated");});
 foreach(var status in new[]{866530001,866530002,866530003,866530004,42}) {var statusValue=status;Test("nonpending "+status,()=>{var s=new Fake();s.Row["mss_appointmentstatus"]=new OptionSetValue(statusValue);Code(Call(s,B,"accept",Change()),"conflict");});}
 Test("reschedule preserves original",()=>{var s=new Fake();Ok(Call(s,B,"reschedule",Change("\"reason\":\"Travel\",\"suggestedDate\":\"2026-07-11\",\"suggestedTime\":\"10:00\",\"suggestedOffsetMinutes\":-240")));Assert(!s.Updated.Contains("mss_preferreddate")&&!s.Updated.Contains("mss_requester"),"immutable");Assert(((OptionSetValue)s.Updated["mss_appointmentstatus"]).Value==866530003,"proposal status");});
 Test("Teams requires https",()=>Code(Call(new Fake(),B,"accept",Change("\"meetingLink\":\"http://example.com\"")),"validation"));
 foreach(var format in new[]{2,3}) {var f=format;Test("offline format "+f,()=>{var s=new Fake();s.Row["mss_meetingformat"]=new OptionSetValue(f);Ok(Call(s,B,"accept",Change("\"meetingLink\":\"\"")));});}
 Test("unknown response field rejected",()=>Code(Call(new Fake(),B,"accept",Change("\"meetingLink\":\"https://example.com\",\"title\":\"forged\"")),"validation"));
 Test("incoming participants and exact count",()=>{var s=new Fake();Ok(Call(s,B,"incoming","{\"page\":1}"));Assert(s.Queries.Any(q=>Has(q.Criteria,"mss_contact",B)),"incoming privacy");Assert(s.Queries.Count(q=>Has(q.Criteria,"mss_contact",B))>=2,"count privacy");});
 Test("outgoing participant filter",()=>{var s=new Fake();Ok(Call(s,A,"outgoing","{\"page\":1}"));Assert(s.Queries.Any(q=>Has(q.Criteria,"mss_requester",A)),"outgoing privacy");});
 Test("calendar requires accepted and either participant",()=>{var s=new Fake();Ok(Call(s,C,"calendar","{\"page\":1,\"month\":\"2026-10\"}"));Assert(s.Queries.Any(q=>Has(q.Criteria,"mss_requester",C)&&Has(q.Criteria,"mss_contact",C)&&Has(q.Criteria,"mss_appointmentstatus",866530001)),"calendar privacy");});
 Test("create requires functional role",()=>{var s=new Fake();s.FunctionalRole=false;Code(Call(s,A,"create",Create()),"forbidden");Assert(s.Created==null,"created without role");});
 Test("pending participant can respond",()=>{var s=new Fake();s.FunctionalRole=false;Ok(Call(s,B,"accept",Change()));});
 Test("pending participant cannot enumerate contact directory",()=>{var s=new Fake();s.FunctionalRole=false;Code(Call(s,B,"contacts","{}"),"forbidden");Assert(!s.Queries.Any(q=>q.EntityName=="contact"&&q.ColumnSet.Columns.Contains("fullname")),"directory queried without role");});
 Test("A outgoing sees one, C outgoing sees none",()=>{var s=new Fake();Assert(Call(s,A,"outgoing","{}").Contains("Budget"),"A missing");Assert(!Call(s,C,"outgoing","{}").Contains("Budget"),"C leak");});
 Test("B incoming sees one, C incoming sees none and no pending count",()=>{var s=new Fake();Assert(Call(s,B,"incoming","{}").Contains("\"awaitingCount\":1"),"B count");string result=Call(s,C,"incoming","{}");Assert(!result.Contains("Budget")&&result.Contains("\"awaitingCount\":0"),"C leak");});
 Test("calendar A/B accepted and C private",()=>{var s=new Fake();s.Row["mss_appointmentstatus"]=new OptionSetValue(866530001);foreach(Guid actor in new[]{A,B})Assert(Call(s,actor,"calendar","{\"month\":\"2026-07\"}").Contains("Budget"),"participant missing");Assert(!Call(s,C,"calendar","{\"month\":\"2026-07\"}").Contains("Budget"),"calendar leak");});
 Test("calendar proposals excluded",()=>{var s=new Fake();s.Row["mss_appointmentstatus"]=new OptionSetValue(866530003);Assert(!Call(s,A,"calendar","{\"month\":\"2026-07\"}").Contains("Budget"),"proposal in calendar");});
 Test("admin broader reads require exact role and site",()=>{var s=new Fake();s.Admin=true;Assert(Call(s,C,"all","{}").Contains("Budget"),"admin denied");var role=s.Queries.First(q=>q.EntityName=="contact"&&q.LinkEntities.Count>0).LinkEntities[0].LinkEntities[0];Assert(Has(role.LinkCriteria,"powerpagecomponentid",new Guid("6ec72c3e-4f1b-420f-9565-d20047b12c1f"))&&Has(role.LinkCriteria,"powerpagesiteid",new Guid("e7f400bd-1e04-4efa-b8b3-7a7a3b168662")),"incorrect admin role");});
 Test("admin personal lists stay scoped",()=>{var s=new Fake{Admin=true};Assert(!Call(s,C,"incoming","{}").Contains("Budget"),"personal incoming polluted");Assert(!Call(s,C,"outgoing","{}").Contains("Budget"),"personal outgoing polluted");});
 Test("ordinary all forbidden",()=>Code(Call(new Fake(),C,"all","{}"),"forbidden"));
 Test("admin calendar stays personal and cannot respond for another",()=>{var s=new Fake{Admin=true};Code(Call(s,C,"accept",Change()),"forbidden");s.Row["mss_appointmentstatus"]=new OptionSetValue(866530001);foreach(Guid actor in new[]{A,B})Assert(Call(s,actor,"calendar","{\"month\":\"2026-07\"}").Contains("Budget"),"participant missing");Assert(!Call(s,C,"calendar","{\"month\":\"2026-07\"}").Contains("Budget"),"admin calendar leaked");});
 Test("legacy requester remains null",()=>{var s=new Fake();s.Row.Attributes.Remove("mss_requester");Assert(Call(s,B,"incoming","{}").Contains("\"requester\":null"),"inferred requester");Assert(!Call(s,A,"outgoing","{}").Contains("Budget"),"legacy ownership inferred");});
 Test("contacts explicitly selects IDs and no identity secrets",()=>{var s=new Fake();Ok(Call(s,A,"contacts","{\"q\":\"test\"}"));var q=s.Queries.Last();Assert(q.ColumnSet.Columns.Contains("contactid")&&q.ColumnSet.Columns.Contains("fullname")&&q.ColumnSet.Columns.Count==2,"contact projection");});
 Test("disabled actor denied",()=>{var s=new Fake();s.Disabled=A;Code(Call(s,A,"outgoing","{}"),"forbidden");});
 Test("duplicate JSON keys rejected",()=>Code(Call(new Fake(),A,"create",Create(",\"title\":\"forged\"")),"validation"));
 Test("invalid formats rejected",()=>Code(Call(new Fake(),A,"create",Create().Replace("\"meetingFormat\":1","\"meetingFormat\":99")),"validation"));
 Test("pre1753 rejected",()=>Code(Call(new Fake(),A,"create",Create(date:"1752-12-31")),"validation"));
 Test("formatted actual labels preserved",()=>{var s=new Fake();s.Row.FormattedValues["mss_appointmentstatus"]="Actual status label";Assert(Call(s,B,"incoming","{}").Contains("Actual status label"),"label changed");});
 Test("plugin uses context user without elevation and trusted actor",()=>{var s=new Fake();var provider=new Provider(s,A,Create());new AppointmentCommandPlugin().Execute(provider);Assert(provider.FactoryUser==C,"SYSTEM/elevated service");Ok((string)provider.Output["Result"]);Assert(((EntityReference)s.Created["mss_requester"]).Id==A,"trusted actor");});
 Test("plugin ignores forged non-Guid actor",()=>{var s=new Fake();var provider=new Provider(s,A.ToString(),Create());new AppointmentCommandPlugin().Execute(provider);Code((string)provider.Output["Result"],"unauthenticated");Assert(s.Created==null,"invalid actor created");});
 Test("external identity eligible without username",()=>{var s=new Fake();s.External=true;Ok(Call(s,A,"create",Create()));});
 Test("missing identity is ineligible",()=>{var s=new Fake();s.NoIdentity=true;Code(Call(s,A,"create",Create()),"forbidden");});
 Test("calendar boundary is Eastern midnight",()=>{var s=new Fake();s.Row["mss_appointmentstatus"]=new OptionSetValue(866530001);s.Row["mss_preferreddate"]=new DateTime(2026,8,1,3,59,0,DateTimeKind.Utc);Assert(Call(s,A,"calendar","{\"month\":\"2026-07\"}").Contains("Budget"),"ET month lost");s.Row["mss_preferreddate"]=new DateTime(2026,8,1,4,0,0,DateTimeKind.Utc);Assert(!Call(s,A,"calendar","{\"month\":\"2026-07\"}").Contains("Budget"),"next month leak");});
 Console.WriteLine(passed+" passed, "+failed+" failed");return failed==0?0:1;
 }
 static bool Has(FilterExpression filter,string attr,object value) { return filter.Conditions.Any(c=>c.AttributeName==attr&&c.Values.Contains(value))||filter.Filters.Any(f=>Has(f,attr,value)); }
 class Fake:IOrganizationService {
  public Entity Created,Updated; public UpdateRequest UpdateRequest; public bool Race,Admin,External,NoIdentity; public bool FunctionalRole=true; public Guid Disabled;
  public List<QueryExpression> Queries=new List<QueryExpression>();
  public Entity Row=new Entity("mss_appointment",Id){RowVersion="7"};
  public Fake(){Row["mss_requester"]=new EntityReference("contact",A){Name="A"};Row["mss_contact"]=new EntityReference("contact",B){Name="B"};Row["mss_appointmentstatus"]=new OptionSetValue(866530000);Row["mss_meetingformat"]=new OptionSetValue(1);Row["mss_preferreddate"]=new DateTime(2026,7,10,13,30,0,DateTimeKind.Utc);Row["mss_appointmenttitle"]="Budget";}
  public Entity Retrieve(string name,Guid id,ColumnSet columns){if(name=="mss_appointment")return Row;var c=new Entity("contact",id);c["statecode"]=new OptionSetValue(id==Disabled?1:0);c["adx_identity_logonenabled"]=true;c["adx_identity_username"]=External||NoIdentity?null:"user";c["fullname"]="Contact";return c;}
  public EntityCollection RetrieveMultiple(QueryBase query){var q=(QueryExpression)query;Queries.Add(q);if(q.EntityName=="adx_externalidentity")return new EntityCollection(External?new List<Entity>{new Entity("adx_externalidentity",Id)}:new List<Entity>());if(q.EntityName=="mss_appointment")return new EntityCollection(Matches(q.Criteria,Row)?new List<Entity>{Row}:new List<Entity>());if(q.EntityName=="contact"&&q.LinkEntities.Count>0&&q.LinkEntities[0].LinkToEntityName=="powerpagecomponent_mspp_webrole_contact"){var role=q.LinkEntities[0].LinkEntities[0];bool create=role.LinkCriteria.Conditions.Any(c=>c.Operator==ConditionOperator.In);return new EntityCollection((create?FunctionalRole:Admin)?new List<Entity>{new Entity("contact",A)}:new List<Entity>());}return new EntityCollection();}
  static bool Matches(FilterExpression f,Entity row){var checks=f.Conditions.Select(c=>Match(c,row)).Concat(f.Filters.Select(child=>Matches(child,row))).ToArray();return f.FilterOperator==LogicalOperator.Or?checks.Any(x=>x):checks.All(x=>x);}
  static bool Match(ConditionExpression c,Entity row){object value=row.Contains(c.AttributeName)?row[c.AttributeName]:null;if(value is EntityReference)value=((EntityReference)value).Id;if(value is OptionSetValue)value=((OptionSetValue)value).Value;object wanted=c.Values.Count>0?c.Values[0]:null;if(c.Operator==ConditionOperator.Equal)return object.Equals(value,wanted);if(c.Operator==ConditionOperator.GreaterEqual)return value!=null&&((DateTime)value)>=(DateTime)wanted;if(c.Operator==ConditionOperator.LessThan)return value!=null&&((DateTime)value)<(DateTime)wanted;throw new Exception("Unsupported fake filter");}
  public Guid Create(Entity entity){Created=entity;return entity.Id;}
  public OrganizationResponse Execute(OrganizationRequest request){var u=request as UpdateRequest;if(u==null)throw new Exception("unexpected request");UpdateRequest=u;if(Race)Row.RowVersion="8";if(u.ConcurrencyBehavior==ConcurrencyBehavior.IfRowVersionMatches&&u.Target.RowVersion!=Row.RowVersion)throw new FaultException<OrganizationServiceFault>(new OrganizationServiceFault{ErrorCode=-2147088254,Message="secret conflict"});Updated=u.Target;return new UpdateResponse();}
  public void Update(Entity entity){throw new Exception("Unconditional updates forbidden");}
  public void Delete(string name,Guid id){throw new NotImplementedException();}public void Associate(string n,Guid id,Relationship r,EntityReferenceCollection e){throw new NotImplementedException();}public void Disassociate(string n,Guid id,Relationship r,EntityReferenceCollection e){throw new NotImplementedException();}
 }
 class Provider:IServiceProvider,IOrganizationServiceFactory {
  Fake service;IPluginExecutionContext context;public Guid? FactoryUser;public ParameterCollection Output=new ParameterCollection();
  public Provider(Fake s,object actor,string payload){service=s;var input=new ParameterCollection();input["ActorContactId"]=actor;input["Command"]="create";input["Payload"]=payload;context=(IPluginExecutionContext)new ContextProxy(input,Output).GetTransparentProxy();}
  public object GetService(Type type){return type==typeof(IPluginExecutionContext)?(object)context:type==typeof(IOrganizationServiceFactory)?this:null;}
  public IOrganizationService CreateOrganizationService(Guid? user){FactoryUser=user;return service;}
 }
 class ContextProxy:RealProxy {
  ParameterCollection input,output;public ContextProxy(ParameterCollection i,ParameterCollection o):base(typeof(IPluginExecutionContext)){input=i;output=o;}
  public override IMessage Invoke(IMessage message){var call=(IMethodCallMessage)message;object value=call.MethodName=="get_MessageName"?(object)"mss_AppointmentCommand":call.MethodName=="get_UserId"?C:call.MethodName=="get_InputParameters"?(object)input:call.MethodName=="get_OutputParameters"?output:null;return new ReturnMessage(value,null,0,call.LogicalCallContext,call);}
 }
}

