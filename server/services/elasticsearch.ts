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

async function waitForDeletion(index: string, timeout = 5000, interval = 500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const exists:any = await client.indices.exists({ index });
    if (!exists.body) {
      return;
    }
    // Wait for a short interval before checking again
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Index ${index} was not deleted within ${timeout}ms`);
}

async function createEventIndex() {
  // Check if we should force re-create the index via an environment flag
  const forceRecreate = true;

  try {
    const exists: any = await client.indices.exists({ index: 'events' });
    if (exists.body) {
      if (forceRecreate) {
        // Delete the index if it exists and the flag is set
        await client.indices.delete({ index: 'events' });
        console.log('Deleted existing "events" index due to FORCE_RECREATE_INDEX flag.');
        // Wait until the deletion is complete
        await waitForDeletion('events', 5000, 500);
      } else {
        console.log('Elasticsearch index "events" already exists. Skipping creation.');
        return;
      }
    }

    // Create the index
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
  } catch (error) {
    console.error('Error creating index:', error);
    throw error;
  }
}

createEventIndex().catch(console.error);

export default client;
