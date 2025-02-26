import { DataTypes, Model, Sequelize } from 'sequelize';

export default (sequelize: Sequelize, shardSuffix?: string) => {
  class EventImage extends Model {}

  const tableName = shardSuffix ? `EventImages_shard${shardSuffix}` : 'EventImages';

  EventImage.init(
    {
      eventID: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      image: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName,
      timestamps: false,
    }
  );

  EventImage.removeAttribute('id');
  return EventImage;
};
