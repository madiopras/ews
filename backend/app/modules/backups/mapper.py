def backup_to_out(row: dict) -> dict:
    return {
        "id": str(row["_id"]),
        "status": row.get("status", "pending"),
        "filename": row.get("filename", ""),
        "size_bytes": row.get("size_bytes", 0),
        "collection_count": row.get("collection_count", 0),
        "document_count": row.get("document_count", 0),
        "created_at": row.get("created_at", ""),
        "completed_at": row.get("completed_at", ""),
        "created_by_email": row.get("created_by_email", ""),
        "error": row.get("error", ""),
    }
