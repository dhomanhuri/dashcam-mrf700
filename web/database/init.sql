-- MRF700 Telematics Database

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) UNIQUE NOT NULL,
  imei VARCHAR(50),
  name VARCHAR(100),
  sim_number VARCHAR(20),
  firmware VARCHAR(100),
  last_seen TIMESTAMP,
  online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gps_records (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  speed FLOAT,
  direction FLOAT,
  altitude FLOAT,
  acc_on BOOLEAN DEFAULT FALSE,
  satellites INT,
  recorded_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_code INT,
  description TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  speed FLOAT,
  raw_data TEXT,
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_packets (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50),
  direction VARCHAR(10) DEFAULT 'IN',
  hex_data TEXT,
  ascii_data TEXT,
  packet_type VARCHAR(50),
  received_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gps_device_id ON gps_records(device_id);
CREATE INDEX IF NOT EXISTS idx_gps_recorded_at ON gps_records(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_device_id ON events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_device_id ON raw_packets(device_id);

-- Insert test device
INSERT INTO devices (device_id, imei, name) 
VALUES ('663065697201', '663065697201', 'MRF700 - DT35115XC')
ON CONFLICT (device_id) DO NOTHING;
