from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    SQLALCHEMY_DATABASE_URI: str = ""

    class Config:
        env_file = ".env"

    @property
    def DATABASE_URL(self):
        return self.SQLALCHEMY_DATABASE_URI

settings = Settings()
