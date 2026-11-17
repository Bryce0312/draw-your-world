async page => {
  await page.context().clearCookies();
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button',{name:'Start drawing',exact:true}).click();
  await page.getByRole('button',{name:'Arrange shapes',exact:true}).click();
  await page.getByRole('button',{name:'Add circle',exact:true}).click();
  const shape=page.getByRole('button',{name:/circle shape; arrow keys move/});
  await shape.focus();const before=await shape.boundingBox();await shape.press('ArrowRight');const after=await shape.boundingBox();
  if(after.x<=before.x)throw new Error('Shape keyboard movement failed');
  await page.getByRole('button',{name:'Talk about my drawing',exact:true}).click();
  await page.getByRole('button',{name:'Continue without AI',exact:true}).click();
  await page.locator('.dw-record textarea').first().fill('A small circle, moved a little to the right.');
  await page.getByRole('button',{name:'Confirm my record',exact:true}).click();
  await page.getByRole('button',{name:'Save without a kind',exact:true}).click();
  await page.getByRole('textbox',{name:'Drawing title',exact:true}).fill('A little circle');
  await page.getByRole('checkbox',{name:/Save this drawing and any reviewed record/}).check();
  await page.getByRole('button',{name:'Save drawing',exact:true}).click();
  await page.getByRole('heading',{name:'Saved to My drawings.'}).waitFor();
  const state=await (await page.request.get('http://127.0.0.1:3000/api/wall')).json();const work=state.session.works.find(w=>w.title==='A little circle');
  if(work.aiConsent||work.kind||work.messages.length||work.observation.status!=='idle'||!work.summary.confirmed)throw new Error('Opt-out/skip path used AI or retained an unwanted kind');
  await page.getByRole('button',{name:'Keep drawing',exact:true}).click();
  const c=page.getByLabel('White drawing wall');
  const corner=await c.evaluate(el=>Array.from(el.getContext('2d').getImageData(0,0,1,1).data));
  if(corner.join(',')!=='255,255,255,255')throw new Error('Drawing background is not pure white');
  return {mobileShapes:'passed',keyboardMovement:'passed',refuseAI:'passed',skipKind:'passed',saveOwnRecord:'passed',whiteExport:'passed'};
}
