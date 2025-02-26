// server/services/elasticsearch.ts
import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: 'https://localhost:9200', // using HTTPS; adjust as needed
  auth: {
    username: 'elastic',
    password: "C_xY+1borKz=Eg_5mpFA", // set via env or replace with your password
  },
  tls: {
    rejectUnauthorized: false, // for local testing only
  },
});

async function createEventIndex() {
  const forceRecreate = true; // or use an environment variable

  try {
    const exists: any = await client.indices.exists({ index: 'events' });
    if (exists.body) {
      if (forceRecreate) {
        // Initiate deletion and log immediately without waiting for completion.
        client.indices
          .delete({ index: 'events' })
          .then(() =>
            console.log('Forced deletion initiated for "events" index.')
          )
          .catch((deleteError) =>
            console.error('Error initiating index deletion:', deleteError)
          );
        console.log(
          'Forced deletion has been initiated; attempting to create index immediately.'
        );
      } else {
        console.log('Elasticsearch index "events" already exists. Skipping creation.');
        return;
      }
    }

    // Attempt to create the index immediately.
    await client.indices.create({
      index: 'events',
      body: {
        mappings: {
          properties: {
            eventID: { type: 'keyword' },
            eventTitle: { type: 'text' },
            description: { type: 'text' },
            location: { type: 'text' },
            eventDate: { type: 'date' },
            eventTypes: { type: 'keyword' },
          },
        },
      },
    });
    console.log('Elasticsearch index "events" created');
  } catch (error: any) {
    // If creation fails because the index still exists, catch that error.
    if (
      error.meta &&
      error.meta.body &&
      error.meta.body.error &&
      error.meta.body.error.type === 'resource_already_exists_exception'
    ) {
      console.log('Index "events" already exists. Forced deletion may still be in progress.');
    } else {
      console.error('Error creating index:', error);
      throw error;
    }
  }
}

createEventIndex().catch(console.error);

export default client;
