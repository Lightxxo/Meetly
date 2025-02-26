// server/models/EventTypeOfEvent.js
import { DataTypes, Model, Sequelize } from 'sequelize';
import client from '../services/elasticSearch';

export default (sequelize: Sequelize) => {
  class EventTypeOfEvent extends Model {}

  EventTypeOfEvent.init(
    {
      eventTypeID: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true, 
      },
      eventID: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true, 
      },
    },
    {
      sequelize,
      tableName: 'EventTypeOfEvents',
      timestamps: false,
    }
  );

  async function updateEventForTypeAssociation(eventID:any) {
    const Event = sequelize.models.Event;
    if (Event) {
      const fullEvent:any = await Event.findByPk(eventID, {
        include: [
          {
            model: sequelize.models.EventType,
            through: { attributes: [] },
            attributes: ['eventType'],
          },
        ],
      });
      const eventTypes:any = fullEvent.EventTypes ? fullEvent.EventTypes.map((et:any) => et.eventType) : [];
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
        console.error('Error updating event type association in ES:', err);
      }
    }
  }

  EventTypeOfEvent.afterCreate(async (association:any) => {
    await updateEventForTypeAssociation(association.eventID);
  });

  EventTypeOfEvent.afterDestroy(async (association:any) => {
    await updateEventForTypeAssociation(association.eventID);
  });

  return EventTypeOfEvent;
};
