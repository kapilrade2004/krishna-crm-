-- Migration: 012_warranty_module.sql
-- Description: Creates warranties, warranty_documents, warranty_service_requests, and warranty_events tables

CREATE TABLE IF NOT EXISTS warranties (
    id VARCHAR(36) PRIMARY KEY,
    warranty_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36),
    product_id VARCHAR(36),
    product_name_snapshot VARCHAR(255) NOT NULL,
    brand_snapshot VARCHAR(100),
    model_snapshot VARCHAR(100),
    marketplace VARCHAR(100),
    purchase_date DATE NOT NULL,
    warranty_start_date DATE NOT NULL,
    warranty_end_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING_VERIFICATION',
    verification_status VARCHAR(30) DEFAULT 'PENDING',
    registration_source VARCHAR(50) DEFAULT 'WEBSITE_FORM',
    terms_accepted BOOLEAN DEFAULT TRUE,
    privacy_accepted BOOLEAN DEFAULT TRUE,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    verified_by VARCHAR(36),
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS warranty_documents (
    id VARCHAR(36) PRIMARY KEY,
    warranty_id VARCHAR(36) NOT NULL,
    document_type VARCHAR(50) DEFAULT 'PURCHASE_INVOICE',
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS warranty_service_requests (
    id VARCHAR(36) PRIMARY KEY,
    service_request_number VARCHAR(50) UNIQUE NOT NULL,
    warranty_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    technician_id VARCHAR(36),
    created_by VARCHAR(36),
    issue VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    status VARCHAR(30) DEFAULT 'NEW',
    assigned_at DATETIME,
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    resolution TEXT,
    parts_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS warranty_events (
    id VARCHAR(36) PRIMARY KEY,
    warranty_id VARCHAR(36) NOT NULL,
    actor_user_id VARCHAR(36),
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_warranties_customer_id ON warranties(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranties_order_id ON warranties(order_id);
CREATE INDEX IF NOT EXISTS idx_warranties_number ON warranties(warranty_number);
CREATE INDEX IF NOT EXISTS idx_warranties_status ON warranties(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_warranty ON warranty_service_requests(warranty_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_technician ON warranty_service_requests(technician_id);
