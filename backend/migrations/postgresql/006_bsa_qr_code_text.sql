-- QR code data URLs are larger than VARCHAR(1000) for realistic certificates.
ALTER TABLE bsa_certificates
    ALTER COLUMN qr_code_image_path TYPE TEXT;