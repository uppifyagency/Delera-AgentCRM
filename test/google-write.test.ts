import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleContactsService, GoogleTasksService, deduplicateContacts, type GooglePeopleApi, type GoogleTasksApi } from '../src/google-write.js';

const readAccount={account:'owner@example.com',subject:'subject',scopes:['https://www.googleapis.com/auth/tasks.readonly','https://www.googleapis.com/auth/tasks','https://www.googleapis.com/auth/contacts.readonly','https://www.googleapis.com/auth/contacts']};

test('Google Tasks adapter reads and writes through typed operations',async()=>{
  const calls:string[]=[];
  const api:GoogleTasksApi={
    tasklists:{list:async()=>({data:{items:[{id:'list-1',title:'CRM'}]}})},
    tasks:{
      list:async()=>({data:{items:[{id:'task-1',title:'Follow up'}]}}),
      insert:async()=>{calls.push('insert');return {data:{id:'task-2',title:'Created'}}},
      update:async()=>{calls.push('update');return {data:{id:'task-1',status:'completed'}}},
      delete:async()=>{calls.push('delete');return {}},
    },
  };
  const service=new GoogleTasksService(readAccount,api);
  assert.equal((await service.listTaskLists())[0].id,'list-1');
  assert.equal((await service.listTasks('list-1'))[0].id,'task-1');
  assert.equal((await service.createTask('list-1',{title:'Created'})).id,'task-2');
  assert.equal((await service.updateTask('list-1',{id:'task-1',status:'completed'})).status,'completed');
  await service.deleteTask('list-1','task-2');
  assert.deepEqual(calls,['insert','update','delete']);
});

test('Google Contacts adapter normalizes and deduplicates contacts',async()=>{
  const api:GooglePeopleApi={
    people:{
      connections:{list:async()=>({data:{connections:[{resourceName:'people/1',names:[{displayName:'Alex'}],emailAddresses:[{value:'Alex@Example.com'}]},{resourceName:'people/2',names:[{displayName:'Alex duplicate'}],emailAddresses:[{value:'alex@example.com'}]}]}})},
      createContact:async()=>({data:{resourceName:'people/3',names:[{displayName:'New'}]}}),
      updateContact:async()=>({data:{resourceName:'people/1',names:[{displayName:'Updated'}]}}),
    },
  };
  const service=new GoogleContactsService(readAccount,api);
  const listed=await service.listContacts();
  assert.equal(listed.contacts[0].emails?.[0],'Alex@Example.com');
  assert.equal((await service.createContact({name:'New'})).resourceName,'people/3');
  assert.equal((await service.updateContact('people/1',{name:'Updated'})).resourceName,'people/1');
  assert.equal(deduplicateContacts(listed.contacts).length,1);
});

test('Google write adapters fail closed without write scopes',async()=>{
  const api={tasklists:{list:async()=>({data:{}})},tasks:{list:async()=>({data:{}}),insert:async()=>({data:{id:'x'}}),update:async()=>({data:{id:'x'}}),delete:async()=>({})}} as unknown as GoogleTasksApi;
  const service=new GoogleTasksService({...readAccount,scopes:['https://www.googleapis.com/auth/tasks.readonly']},api);
  await assert.rejects(service.createTask('list-1',{title:'blocked'}),/required Google scope missing/);
});
