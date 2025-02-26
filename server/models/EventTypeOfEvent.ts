import { DataTypes, Model, Sequelize } from 'sequelize';

export default (sequelize: Sequelize, shardSuffix?: string) => {
  class EventTypeOfEvent extends Model {}

  const tableName = shardSuffix ? `EventTypeOfEvents_shard${shardSuffix}` : 'EventTypeOfEvents';

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
      tableName,
      timestamps: false,
    }
  );

  return EventTypeOfEvent;
};
