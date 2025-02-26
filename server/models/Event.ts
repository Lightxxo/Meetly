import { DataTypes, Model, Sequelize } from 'sequelize';

export default (sequelize: Sequelize, shardSuffix?: string) => {
  class Event extends Model {}

  // If a shardSuffix is provided, use a different physical table name
  const tableName = shardSuffix ? `Events_shard${shardSuffix}` : 'Events';

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
      tableName,
      timestamps: true,
    }
  );

  return Event;
};
