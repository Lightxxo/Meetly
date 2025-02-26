import { DataTypes, Model, Sequelize } from 'sequelize';

export default (sequelize: Sequelize, shardSuffix?: string) => {
  class EventAttendance extends Model {}

  const tableName = shardSuffix ? `EventAttendance_shard${shardSuffix}` : 'EventAttendance';

  EventAttendance.init(
    {
      eventID: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      userID: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      status: {
        type: DataTypes.ENUM('Going', 'Interested', 'Not Going'),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName,
      timestamps: false,
    }
  );
  // Remove the default id attribute that Sequelize adds
  EventAttendance.removeAttribute('id');
  return EventAttendance;
};
