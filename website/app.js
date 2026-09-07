const button=document.getElementById('copy-prompt');
button?.addEventListener('click',async()=>{
  const text=document.getElementById('starter-prompt').textContent;
  const status=document.getElementById('copy-status');
  try{await navigator.clipboard.writeText(text);status.textContent='Copied. Paste it into your agent conversation.';}
  catch{status.textContent='Select the prompt above and copy it manually.';}
});
