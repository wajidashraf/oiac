using System;
using System.IO;
using System.Linq;
using Microsoft.Xrm.Sdk;
class SiteActivityLogPortalPlanTests {
 static void Need(bool value,string message){if(!value)throw new Exception(message);}
 static bool Refused(Action action){try{action();return false;}catch(InvalidOperationException){return true;}}
 static int Main(){try{
  string root=Path.Combine(Path.GetTempPath(),"oiac-portal-plan-tests-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
  var f=new SiteActivityLogCanaryAdminTests.Fake();RegisterSiteActivityLogObservers.Apply(f,f.Assembly,false,false,Path.Combine(root,"native.json"));foreach(var guard in f.Rows.Where(e=>e.LogicalName=="sdkmessageprocessingstep"&&e.GetAttributeValue<string>("name").StartsWith("OIAC History mss_activitylog "))){guard["statecode"]=new OptionSetValue(0);guard["statuscode"]=new OptionSetValue(1);}
  int before=f.Writes;RegisterSiteActivityLogPortalPlan.Configure(f,f.Assembly,Path.Combine(root,"portal.json"));Need(f.Rows.Count(e=>e.LogicalName=="sdkmessageprocessingstep")==34&&f.Transactions==34,"native eighteen plus portal sixteen must commit disabled atomically");var portal=f.Rows.Where(e=>e.LogicalName=="sdkmessageprocessingstep"&&(e.GetAttributeValue<string>("name").StartsWith("OIAC History Portal ")||e.GetAttributeValue<string>("name")=="OIAC History Coverage Upload Stamp")).ToArray();Need(portal.Length==16&&portal.All(e=>e.GetAttributeValue<OptionSetValue>("statecode").Value==1),"all portal capture disabled before activation");
  var image=f.Rows.First(e=>e.LogicalName=="sdkmessageprocessingstepimage"&&portal.Any(p=>p.Id==e.GetAttributeValue<EntityReference>("sdkmessageprocessingstepid").Id));string original=image.GetAttributeValue<string>("attributes");image["attributes"]="wrong_column";before=f.Writes;Need(Refused(()=>RegisterSiteActivityLogPortalPlan.Activate(f,f.Assembly,Path.Combine(root,"bad-image.json")))&&f.Writes==before,"wrong image must refuse all activation");image["attributes"]=original;
  f.WrongAssemblyContent=true;before=f.Writes;Need(Refused(()=>RegisterSiteActivityLogPortalPlan.Activate(f,f.Assembly,Path.Combine(root,"bad-runtime.json")))&&f.Writes==before,"stale deployed runtime must refuse activation");f.WrongAssemblyContent=false;
  RegisterSiteActivityLogPortalPlan.Activate(f,f.Assembly,Path.Combine(root,"activate.json"));Need(f.Activations==16&&portal.All(e=>e.GetAttributeValue<OptionSetValue>("statecode").Value==0),"activate exactly portal sixteen");before=f.Writes;RegisterSiteActivityLogPortalPlan.Activate(f,f.Assembly,Path.Combine(root,"resume.json"));Need(f.Writes==before,"activation resume must not repeat state writes");
  var wrong=new SiteActivityLogCanaryAdminTests.Fake{WrongOrg=true};Need(Refused(()=>RegisterSiteActivityLogPortalPlan.Configure(wrong,wrong.Assembly,Path.Combine(root,"wrong-org.json")))&&wrong.Writes==0,"wrong organization must refuse before mutation");
  var partial=new SiteActivityLogCanaryAdminTests.Fake{FailDisable=true};Need(Refused(()=>RegisterSiteActivityLogPortalPlan.Configure(partial,partial.Assembly,Path.Combine(root,"rollback.json")))&&!partial.Rows.Any(e=>e.LogicalName=="sdkmessageprocessingstep"),"failed disabled creation must not expose enabled capture");
  Console.WriteLine("PASS portal plan all-component/runtime/image preflight, sixteen disabled atomic registrations, exact sixteen activation, idempotent resume, wrong-org refusal and rollback.");return 0;
 }catch(Exception e){Console.Error.WriteLine("FAIL "+e.Message);return 1;}}
}
