import os

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

load_dotenv()

_storage_client = None


def get_blob_service_client():
    global _storage_client
    if _storage_client is not None:
        return _storage_client

    storage_account = os.getenv("AZURE_STORAGE_ACCOUNT")
    if not storage_account:
        raise RuntimeError("AZURE_STORAGE_ACCOUNT is not configured")

    _storage_client = BlobServiceClient(
        account_url=f"https://{storage_account}.blob.core.windows.net",
        credential=DefaultAzureCredential(),
    )
    return _storage_client


def upload_blob(file_data, container_name, blob_name):
    container_client = get_blob_service_client().get_container_client(container_name)

    # Make the upload endpoint self-contained: a fresh environment does not
    # require the container to be created manually first.
    try:
        container_client.create_container()
    except Exception as exc:
        # Azure raises ResourceExistsError when the container already exists.
        # Avoid importing an SDK-specific exception just for this harmless case.
        if getattr(exc, "status_code", None) != 409:
            raise

    blob_client = container_client.get_blob_client(blob_name)
    blob_client.upload_blob(file_data, overwrite=True)
    return blob_name


def download_blob(container_name, blob_name):
    return (
        get_blob_service_client()
        .get_container_client(container_name)
        .get_blob_client(blob_name)
        .download_blob()
        .readall()
    )


def list_blob_names(container_name, prefix):
    container_client = get_blob_service_client().get_container_client(container_name)
    try:
        return [blob.name for blob in container_client.list_blobs(name_starts_with=prefix)]
    except Exception as exc:
        if getattr(exc, "status_code", None) != 404:
            raise
        try:
            container_client.create_container()
        except Exception as create_exc:
            if getattr(create_exc, "status_code", None) != 409:
                raise
        return []
