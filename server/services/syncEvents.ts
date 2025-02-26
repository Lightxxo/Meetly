// server/services/syncEvents.ts
import db from '../models';
import client from './elasticSearch'; // make sure the filename matches exactly (all lowercase)

async function syncEvents() {
  // Fetch events along with associated event types
  const events = await db.Event.findAll({
    include: [
      {
        model: db.EventType,
        through: { attributes: [] },
        attributes: ['eventType'],
      },
    ],
  });

  const body = events.flatMap((event: any) => {
    const eventTypes = event.EventTypes ? event.EventTypes.map((et: any) => et.eventType) : [];
    return [
      { index: { _index: 'events', _id: event.eventID } },
      {
        eventID: event.eventID,
        eventTitle: event.eventTitle,
        description: event.description,
        location: event.location,
        eventDate: event.eventDate,
        eventTypes,
      },
    ];
  });

  if (body.length > 0) {
    const bulkResponse = await client.bulk({ refresh: true, body });
    if (bulkResponse.errors) {
      console.error('Bulk indexing had errors', bulkResponse.errors);
    } else {
      console.log('All events synced to Elasticsearch successfully');
    }
  }
}

syncEvents().catch(console.error);
