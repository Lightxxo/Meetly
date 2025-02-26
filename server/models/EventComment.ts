import { DataTypes, Model, Sequelize } from 'sequelize';

export default (sequelize: Sequelize, shardSuffix?: string) => {
  class EventComment extends Model {}

  const tableName = shardSuffix ? `EventComments_shard${shardSuffix}` : 'EventComments';

  EventComment.init(
    {
      commentID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      eventID: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      userID: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      rating: {
        type: DataTypes.DECIMAL(2, 1),
        allowNull: false,
        validate: { min: 1.0, max: 5.0 },
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      tableName,
      timestamps: false,
    }
  );

  return EventComment;
};
