from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# BURAYI KENDİ BİLGİLERİNİZE GÖRE DÜZENLEYİN:
# format: postgresql://kullanıcı_adı:şifre@localhost:5432/veritabanı_adı
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:foamderas@localhost:5432/PNo2"


engine = create_engine(SQLALCHEMY_DATABASE_URL)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()