"""Synchronous Mongo dump adapter, always invoked outside the event loop."""

import gzip
import os
from datetime import datetime, timezone
from pathlib import Path

from bson import json_util
from pymongo import MongoClient

from app.modules.backups.exceptions import BackupError


class BackupFileGateway:
    def __init__(self, directory: Path, mongo_url: str, database_name: str):
        self.directory = directory.resolve()
        self.mongo_url, self.database_name = mongo_url, database_name

    def path(self, filename: str) -> Path:
        if not filename or Path(filename).name != filename:
            raise BackupError(400, "Invalid backup path")
        target = (self.directory / filename).resolve()
        try:
            target.relative_to(self.directory)
        except ValueError as error:
            raise BackupError(400, "Invalid backup path") from error
        return target

    def ready(self) -> bool:
        self.directory.mkdir(parents=True, exist_ok=True)
        return os.access(self.directory, os.W_OK)

    def exists(self, filename: str) -> bool:
        return self.path(filename).is_file()

    def delete(self, filename: str) -> None:
        target = self.path(filename)
        if target.is_file():
            target.unlink()

    def write(self, filename: str) -> dict:
        target = self.path(filename)
        target.parent.mkdir(parents=True, exist_ok=True)
        client = MongoClient(self.mongo_url, serverSelectionTimeoutMS=10000)
        documents = collections = 0
        try:
            database = client[self.database_name]
            client.admin.command("ping")
            with gzip.open(target, "wt", encoding="utf-8") as stream:
                stream.write(
                    json_util.dumps(
                        {
                            "type": "metadata",
                            "database": self.database_name,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "format": "mongodb-extended-json-lines-v1",
                        }
                    )
                    + "\n"
                )
                for name in sorted(database.list_collection_names()):
                    collections += 1
                    stream.write(
                        json_util.dumps({"type": "collection", "name": name}) + "\n"
                    )
                    for document in database[name].find({}):
                        stream.write(
                            json_util.dumps(
                                {
                                    "type": "document",
                                    "collection": name,
                                    "document": document,
                                }
                            )
                            + "\n"
                        )
                        documents += 1
            os.chmod(target, 0o600)
            return {
                "collection_count": collections,
                "document_count": documents,
                "size_bytes": target.stat().st_size,
            }
        finally:
            client.close()
