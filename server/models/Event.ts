// server/models/Event.js
import { DataTypes, Model, Sequelize } from 'sequelize';
import client from '../services/elasticsearch';

export default (sequelize: Sequelize) => {
  class Event extends Model {
    /**
     * Re-index an event in Elasticsearch, including its associated event types.
     * @param eventInstance The event instance to reindex.
     */
    static async reindexEvent(eventInstance: any): Promise<void> {
      // Retrieve the full event with its associated EventType records.
      const fullEvent: any = await Event.findByPk(eventInstance.eventID, {
        include: [
          {
            model: sequelize.models.EventType,
            // Use the alias as defined in your associations. Change 'EventTypes' if necessary.
            as: 'EventTypes',
            through: { attributes: [] },
            attributes: ['eventType'],
          },
        ],
      });
    
      if (!fullEvent) {
        console.warn(`Reindexing skipped: No event found with ID ${eventInstance.eventID}`);
        return;
      }
    
      // Debug: log the retrieved associations
      console.log(`Reindexing event ${fullEvent.eventID}:`, fullEvent);
    
      // Try to read the join data. Adjust the property name if your association uses a different alias.
      const eventTypesArray = fullEvent.EventTypes || fullEvent.types || [];
      const eventTypes = eventTypesArray.map((et: any) => et.eventType);
    
      try {
        await client.index({
          index: 'events',
          id: fullEvent.eventID,
          body: {
            eventID: fullEvent.eventID,
            eventTitle: fullEvent.eventTitle,
            description: fullEvent.description,
            location: fullEvent.location,
            eventDate: fullEvent.eventDate,
            eventTypes, // This should now contain the join data.
          },
        });
        console.log(`Event ${fullEvent.eventID} reindexed successfully with eventTypes: ${eventTypes}`);
      } catch (err) {
        console.error('Error reindexing event:', err);
      }
    }
  }

  Event.init(
    {
      eventID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      hostID: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      eventTitle: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      thumbnail: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      eventDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'Events',
      timestamps: true,
    }
  );

  // Hooks to trigger reindexing in Elasticsearch
  Event.afterCreate(async (event) => {
    await Event.reindexEvent(event);
  });

  Event.afterUpdate(async (event) => {
    await Event.reindexEvent(event);
  });

  Event.afterDestroy(async (event: any) => {
    try {
      await client.delete({
        index: 'events',
        id: event.eventID,
      });
      console.log(`Event ${event.eventID} deleted from Elasticsearch.`);
    } catch (err) {
      console.error('Error deleting event from Elasticsearch:', err);
    }
  });

  return Event;
};
