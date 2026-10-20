using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Oiac.Engage.SiteActivityLog;
class SiteActivityLogConfigurationTests {
 class Service:IOrganizationService,IOrganizationServiceFactory {
  public List<Entity> Created=new List<Entity>();public IOrganizationService CreateOrganizationService(Guid? user){return this;}
  public Guid Create(Entity e){Created.Add(e);return e.Id;}public Entity Retrieve(string table,Guid id,ColumnSet columns){if(table!="contact")throw new Exception();var e=new Entity(table,id);e["fullname"]="Configuration proof actor";return e;}
  public EntityCollection RetrieveMultiple(QueryBase q){return new EntityCollection();}public void Update(Entity e){throw new Exception();}public void Delete(string t,Guid id){throw new Exception();}public OrganizationResponse Execute(OrganizationRequest r){throw new Exception();}public void Associate(string t,Guid i,Relationship r,EntityReferenceCollection c){throw new Exception();}public void Disassociate(string t,Guid i,Relationship r,EntityReferenceCollection c){throw new Exception();}
 }
 class Provider:IServiceProvider {readonly IPluginExecutionContext c;readonly Service s;public Provider(IPluginExecutionContext context,Service service){c=context;s=service;}public object GetService(Type t){if(t==typeof(IPluginExecutionContext))return c;if(t==typeof(IOrganizationServiceFactory))return s;return null;}}
 static int Main(){try{
  var pair=SiteActivityLogNativeProvenanceTests.Make("mss_activitypost","Delete","remove");SiteActivityLogNativeProvenanceTests.Stamp(pair);var pre=new EntityImageCollection();pre["PreImage"]=new Entity("mss_activitypost",pair.Id);pair.Async.V["PreEntityImages"]=pre;pair.Async.V["PostEntityImages"]=new EntityImageCollection();pair.Async.V["OperationId"]=Guid.NewGuid();pair.Async.V["OperationCreatedOn"]=DateTime.UtcNow;
  var service=new Service();new SiteActivityLogCapturePlugin().Execute(new Provider(pair.Async.Proxy,service));if(service.Created.Count!=1||service.Created[0].GetAttributeValue<OptionSetValue>("mss_action").Value!=866530017)throw new Exception("Supported parameterless construction must capture the verified Deleted choice");
  var configured=(IPlugin)Activator.CreateInstance(typeof(SiteActivityLogCapturePlugin),new object[]{"deletedAction=866530017",null});service=new Service();configured.Execute(new Provider(pair.Async.Proxy,service));if(service.Created.Count!=1)throw new Exception("Two-string construction must capture deletion");
  var portal=SiteActivityLogNativeProvenanceTests.Make();portal.Async.V["Depth"]=1;portal.Async.V["UserId"]=new Guid("605697c5-69a5-f111-b8dd-002248042536");portal.Async.V["InitiatingUserId"]=portal.Async.V["UserId"];portal.Async.V["IsPortalsClientCall"]=true;portal.Async.V["PortalsContactId"]=Guid.NewGuid();portal.Async.V["PrimaryEntityName"]="mss_presscoverage";portal.Async.V["PreEntityImages"]=new EntityImageCollection();portal.Async.V["PostEntityImages"]=new EntityImageCollection();bool retry=false;try{new SiteActivityLogLegacyCapturePlugin().Execute(new Provider(portal.Async.Proxy,new Service()));}catch(InvalidPluginExecutionException e){retry=e.Status==OperationStatus.Retry;}if(!retry)throw new Exception("Default portal observer must use the verified UAT identity and report missing snapshots");
  Activator.CreateInstance(typeof(SiteActivityLogLegacyCapturePlugin),new object[]{"integrationUser=605697c5-69a5-f111-b8dd-002248042536;organization=3f613eb3-72ea-f011-aa23-6045bd003f09",null});
  Console.WriteLine("PASS supported default/two-string plugin construction preserves Deleted capture and verified portal configuration.");return 0;
 }catch(Exception e){Console.Error.WriteLine("FAIL "+e.Message);return 1;}}
}
