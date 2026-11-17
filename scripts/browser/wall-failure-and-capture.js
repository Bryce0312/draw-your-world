async page => {
  const base='http://127.0.0.1:3000';
  await page.setViewportSize({width:1440,height:900});
  for(const [hash,name,wait] of [['','home-desktop','Start drawing'],['#draw','drawing-desktop','Talk about my drawing'],['#talk','talk-desktop','Send'],['#kind','kind-desktop','Save this drawing']]) {
    await page.goto(base+'/'+hash);
    await page.getByRole('button',{name:wait,exact:true}).waitFor();
    await page.screenshot({path:'docs/screenshots/white-wall/'+name+'.png',animations:'disabled',timeout:30000});
  }
  await page.goto(base+'/#talk');
  const input=page.getByRole('textbox',{name:'Your reply'});await input.waitFor();
  const before=await page.getByLabel('White drawing wall').evaluate(el=>el.toDataURL());
  let attempts=0;
  const snapshot=await (await page.request.get(base+'/api/wall')).json();
  await page.route('**/api/wall',async route=>{
    if(route.request().method()==='POST'&&route.request().postDataJSON().action==='message') {
      attempts++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({...snapshot,error:'The reply did not finish. Your drawing and words are kept.'})});
    } else await route.continue();
  });
  await input.fill('A retryable test message.');
  await page.getByRole('button',{name:'Send',exact:true}).dblclick();
  await page.getByText('The reply did not finish. Your drawing and words are kept.',{exact:true}).waitFor();
  if(attempts!==1||await input.inputValue()!=='A retryable test message.')throw new Error('Duplicate request or lost failed input');
  if(before!==await page.getByLabel('White drawing wall').evaluate(el=>el.toDataURL()))throw new Error('Failure changed drawing');
  await page.unroute('**/api/wall');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByRole('button',{name:'Make a record',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'docs/screenshots/white-wall/talk-mobile.png',animations:'disabled',timeout:30000});
  await page.goto(base+'/');
  await page.getByRole('button',{name:'Start drawing',exact:true}).waitFor();
  await page.screenshot({path:'docs/screenshots/white-wall/home-mobile.png',animations:'disabled',timeout:30000});
  const response=await page.request.get(base+'/api/wall');const state=await response.json();
  const work=state.session.works.find(w=>w.title==='Kite string study');
  const confirmed=await (await page.request.post(base+'/api/wall',{data:{action:'confirm_summary',workId:work.id,text:'I drew a kite string and enjoyed following its curve.'}})).json();
  const current=confirmed.session.works.find(w=>w.id===work.id);
  await page.request.post(base+'/api/wall',{data:{action:'share',workId:work.id,includeArtwork:false,includeSummary:true,confirmed:true,expectedRevision:current.revision}});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base+'/professional');await page.getByRole('heading',{name:'Their confirmed record'}).waitFor();
  if(await page.locator('.professional-record>img').count())throw new Error('Excluded drawing appeared in professional UI');
  await page.screenshot({path:'docs/screenshots/white-wall/professional-desktop.png',animations:'disabled',timeout:30000});
  const shared=await (await page.request.get(base+'/api/wall')).json();
  for(const share of shared.session.shares.filter(s=>!s.revokedAt))await page.request.post(base+'/api/wall',{data:{action:'revoke_share',shareId:share.id}});
  return {screenshots:'captured',failureInputAndArtwork:'retained',doubleClick:'one submission',retry:'passed',professionalSummaryOnly:'passed'};
}
