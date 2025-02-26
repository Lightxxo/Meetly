// server/models/Event.js
import { DataTypes, Model, Sequelize } from 'sequelize';
import client from '../services/elasticSearch'

export default (sequelize: Sequelize) => {
  class Event extends Model {}

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

  // Helper function: reindex an event (including associated event types)
  async function reindexEvent(eventInstance:any) {
    const fullEvent:any = await Event.findByPk(eventInstance.eventID, {
      include: [
        {
          model: sequelize.models.EventType,
          through: { attributes: [] },
          attributes: ['eventType'],
        },
      ],
    });
    const eventTypes = fullEvent.EventTypes ? fullEvent.EventTypes.map((et:any) => et.eventType) : [];

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
          eventTypes,
        },
      });
    } catch (err) {
      console.error('Error reindexing event:', err);
    }
  }

  Event.afterCreate(async (event) => {
    await reindexEvent(event);
  });

  Event.afterUpdate(async (event) => {
    await reindexEvent(event);
  });

  Event.afterDestroy(async (event:any) => {
    try {
      await client.delete({
        index: 'events',
        id: event.eventID,
      });
    } catch (err) {
      console.error('Error deleting event from Elasticsearch:', err);
    }
  });

  return Event;
};
