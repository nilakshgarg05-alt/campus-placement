from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv
import urllib.parse
import struct
import os

load_dotenv()

server = os.getenv("DB_SERVER")
database = os.getenv("DB_NAME")

credential = DefaultAzureCredential()

SQL_COPT_SS_ACCESS_TOKEN = 1256

connection_string = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={server};"
    f"DATABASE={database};"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
)

params = urllib.parse.quote_plus(connection_string)

engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={params}",
    pool_pre_ping=True
)


@event.listens_for(engine, "do_connect")
def provide_token(dialect, conn_rec, cargs, cparams):

    token = credential.get_token(
        "https://database.windows.net/.default"
    ).token

    token_bytes = token.encode("utf-16-le")

    token_struct = struct.pack(
        f"<I{len(token_bytes)}s",
        len(token_bytes),
        token_bytes
    )

    cparams["attrs_before"] = {
        SQL_COPT_SS_ACCESS_TOKEN: token_struct
    }


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)