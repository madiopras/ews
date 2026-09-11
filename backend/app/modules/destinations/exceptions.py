"""Typed application errors for destination use cases."""


class DestinationReadError(Exception):
    """Base error carrying the legacy-compatible public detail message."""

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class InvalidDestinationId(DestinationReadError):
    """A destination identifier cannot be parsed by the persistence adapter."""


class DestinationNotFound(DestinationReadError):
    """No publicly visible destination matches the requested identifier."""


class DestinationValidationError(DestinationReadError):
    """Destination input or an admin query violates a business rule."""
