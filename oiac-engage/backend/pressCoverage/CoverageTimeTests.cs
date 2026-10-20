using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Crm.Sdk.Messages;
using Oiac.Engage.PressCoverage;

public static class CoverageTimeTests {
 static int passed, failed;
 static void Test(string name,Action run) { try { run();passed++;Console.WriteLine("PASS "+name); } catch(Exception e) { failed++;Console.WriteLine("FAIL "+name+": "+e.Message); } }
 static void Assert(bool condition,string message) { if(!condition)throw new Exception(message); }
 public static int Main() {
  Test("forwards UTC and fixed Dataverse timezone without record operations",()=>{var fake=new ReadOnlyService();var result=CoverageTimePlugin.ConvertUtc(fake,"2026-10-17T23:30:00Z");Assert(result=="2026-10-18T02:30:00.000Z","wall time");Assert(fake.Calls==1&&fake.TimeZoneCode==129,"native timezone");Assert(fake.Utc.Kind==DateTimeKind.Utc&&fake.Utc.Hour==23,"UTC input");});
  Test("retains historical conversion from native Dataverse response",()=>{var fake=new ReadOnlyService{Offset=2};Assert(CoverageTimePlugin.ConvertUtc(fake,"2020-01-02T10:00:00Z")=="2020-01-02T12:00:00.000Z","historical rule");});
  Test("accepts Dataverse fractional UTC timestamps",()=>{var fake=new ReadOnlyService();Assert(CoverageTimePlugin.ConvertUtc(fake,"2026-10-17T00:00:00.1234567Z")=="2026-10-17T03:00:00.123Z","fraction");});
  Test("accepts valid leap day",()=>{var fake=new ReadOnlyService();CoverageTimePlugin.ConvertUtc(fake,"2024-02-29T00:00:00Z");Assert(fake.Calls==1,"native request");});
  foreach(var bad in new[]{null,"","2026-10-17","2026-02-30T00:00:00Z","2026-10-17T24:00:00Z","2026-10-17T00:00:00+03:00","2026-10-17T00:00:00","1752-12-31T23:00:00Z"," 2026-10-17T00:00:00Z","2026-10-17T00:00:00.12345678Z","2026-10-17T00:00:00Z?timezone=1"}) {var value=bad;Test("reject invalid timestamp "+(value??"null"),()=>{var fake=new ReadOnlyService();bool rejected=false;try{CoverageTimePlugin.ConvertUtc(fake,value);}catch(InvalidPluginExecutionException){rejected=true;}Assert(rejected&&fake.Calls==0,"invalid request reached native SDK");});}
  Test("native failure propagates without offset fallback",()=>{var fake=new ReadOnlyService{Fail=true};bool nativeFailed=false;try{CoverageTimePlugin.ConvertUtc(fake,"2026-10-17T00:00:00Z");}catch(InvalidOperationException){nativeFailed=true;}Assert(nativeFailed&&fake.Calls==1,"native fault hidden");});
  Console.WriteLine(passed+" passed, "+failed+" failed");return failed==0?0:1;
 }
 sealed class ReadOnlyService:IOrganizationService {
  public int Offset=3,Calls,TimeZoneCode;public DateTime Utc;public bool Fail;
  public OrganizationResponse Execute(OrganizationRequest request) {Calls++;var conversion=request as LocalTimeFromUtcTimeRequest;if(conversion==null)throw new Exception("Unexpected SDK operation");TimeZoneCode=conversion.TimeZoneCode;Utc=conversion.UtcTime;if(Fail)throw new InvalidOperationException("Native conversion unavailable");var response=new LocalTimeFromUtcTimeResponse();response.Results["LocalTime"]=DateTime.SpecifyKind(Utc.AddHours(Offset),DateTimeKind.Unspecified);return response;}
  public Guid Create(Entity entity){throw new Exception("No record writes allowed");}public void Update(Entity entity){throw new Exception("No record writes allowed");}public void Delete(string name,Guid id){throw new Exception("No record writes allowed");}public Entity Retrieve(string name,Guid id,ColumnSet columns){throw new Exception("No record reads allowed");}public EntityCollection RetrieveMultiple(QueryBase query){throw new Exception("No record reads allowed");}public void Associate(string name,Guid id,Relationship relationship,EntityReferenceCollection related){throw new Exception("No associations allowed");}public void Disassociate(string name,Guid id,Relationship relationship,EntityReferenceCollection related){throw new Exception("No associations allowed");}
 }
}
