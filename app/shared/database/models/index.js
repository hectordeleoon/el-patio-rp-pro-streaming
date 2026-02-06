import { Sequelize, DataTypes } from 'sequelize';
import logger from '../../utils/logger.js';

let sequelize;

// Streamer Model
export const StreamerModel = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  display_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  twitch_username: {
    type: DataTypes.STRING,
    unique: true,
  },
  twitch_user_id: {
    type: DataTypes.STRING,
    unique: true,
  },
  youtube_channel_id: {
    type: DataTypes.STRING,
    unique: true,
  },
  kick_username: {
    type: DataTypes.STRING,
    unique: true,
  },
  profile_image_url: {
    type: DataTypes.STRING,
  },
  bio: {
    type: DataTypes.TEXT,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_live: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  current_stream_id: {
    type: DataTypes.UUID,
  },
  viewer_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_clips: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  best_viral_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  last_stream_at: {
    type: DataTypes.DATE,
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
};

// Stream Model
export const StreamModel = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  streamer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'streamers',
      key: 'id',
    },
  },
  platform: {
    type: DataTypes.ENUM('twitch', 'youtube', 'kick'),
    allowNull: false,
  },
  platform_stream_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
  },
  game: {
    type: DataTypes.STRING,
  },
  game_id: {
    type: DataTypes.STRING,
  },
  viewer_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  ended_at: {
    type: DataTypes.DATE,
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
  },
  thumbnail_url: {
    type: DataTypes.STRING,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_valid_rp: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
};

// Clip Model
export const ClipModel = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  streamer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'streamers',
      key: 'id',
    },
  },
  stream_id: {
    type: DataTypes.UUID,
    references: {
      model: 'streams',
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  file_path: {
    type: DataTypes.STRING,
  },
  edited_file_path: {
    type: DataTypes.STRING,
  },
  horizontal_file_path: {
    type: DataTypes.STRING,
  },
  vertical_file_path: {
    type: DataTypes.STRING,
  },
  square_file_path: {
    type: DataTypes.STRING,
  },
  thumbnail_url: {
    type: DataTypes.STRING,
  },
  hook_file_path: {
    type: DataTypes.STRING,
  },
  subtitles_path: {
    type: DataTypes.STRING,
  },
  viral_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM(
      'processing',
      'edited',
      'ready',
      'pending_approval',
      'approved',
      'published',
      'rejected'
    ),
    defaultValue: 'processing',
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  shares: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
};

// Publication Model
export const PublicationModel = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  clip_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'clips',
      key: 'id',
    },
  },
  platform: {
    type: DataTypes.ENUM('tiktok', 'instagram', 'youtube_shorts', 'discord'),
    allowNull: false,
  },
  platform_post_id: {
    type: DataTypes.STRING,
  },
  platform_url: {
    type: DataTypes.STRING,
  },
  caption: {
    type: DataTypes.TEXT,
  },
  hashtags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  status: {
    type: DataTypes.ENUM('pending', 'scheduled', 'published', 'failed'),
    defaultValue: 'pending',
  },
  scheduled_at: {
    type: DataTypes.DATE,
  },
  published_at: {
    type: DataTypes.DATE,
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  comments: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  shares: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  error_message: {
    type: DataTypes.TEXT,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
};

// User Model (for admin panel)
export const UserModel = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  discord_id: {
    type: DataTypes.STRING,
    unique: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING,
  },
  role: {
    type: DataTypes.ENUM('admin', 'moderator', 'viewer'),
    defaultValue: 'viewer',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_login_at: {
    type: DataTypes.DATE,
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
};

export function initModels(sequelizeInstance) {
  sequelize = sequelizeInstance;

  const Streamer = sequelize.define('Streamer', StreamerModel, {
    tableName: 'streamers',
    timestamps: true,
  });

  const Stream = sequelize.define('Stream', StreamModel, {
    tableName: 'streams',
    timestamps: true,
  });

  const Clip = sequelize.define('Clip', ClipModel, {
    tableName: 'clips',
    timestamps: true,
  });

  const Publication = sequelize.define('Publication', PublicationModel, {
    tableName: 'publications',
    timestamps: true,
  });

  const User = sequelize.define('User', UserModel, {
    tableName: 'users',
    timestamps: true,
  });

  // Associations
  Streamer.hasMany(Stream, { foreignKey: 'streamer_id', as: 'streams' });
  Stream.belongsTo(Streamer, { foreignKey: 'streamer_id', as: 'streamer' });

  Streamer.hasMany(Clip, { foreignKey: 'streamer_id', as: 'clips' });
  Clip.belongsTo(Streamer, { foreignKey: 'streamer_id', as: 'streamer' });

  Stream.hasMany(Clip, { foreignKey: 'stream_id', as: 'clips' });
  Clip.belongsTo(Stream, { foreignKey: 'stream_id', as: 'stream' });

  Clip.hasMany(Publication, { foreignKey: 'clip_id', as: 'publications' });
  Publication.belongsTo(Clip, { foreignKey: 'clip_id', as: 'clip' });

  logger.info('✅ Modelos de base de datos inicializados');

  return {
    Streamer,
    Stream,
    Clip,
    Publication,
    User,
  };
}

export default {
  initModels,
};
