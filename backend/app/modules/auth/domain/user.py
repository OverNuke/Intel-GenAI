from dataclasses import dataclass
from typing import Literal

Role = Literal["user", "it", "supervisor"]


@dataclass(frozen=True)
class User:
    id: str
    display_name: str
    email: str
    role: Role
    area: str
