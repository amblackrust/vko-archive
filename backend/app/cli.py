"""Admin CLI.

    python -m app.cli ensure-roles
    python -m app.cli create-user --email admin@demo.kz --role super_admin [--branch-id UUID] [--full-name ...]

The password is read from the VKO_USER_PASSWORD environment variable or prompted for
(never passed as an argument, so it does not end up in shell history or `ps`).
"""

import argparse
import getpass
import os
import sys
import uuid

from app.db import get_sessionmaker
from app.models import User
from app.models.enums import RoleCode
from app.repositories import roles as roles_repo
from app.repositories import users as users_repo
from app.security import hash_password
from app.services.auth import normalize_email, validate_new_password
from app.services.authz import ensure_roles_and_permissions
from app.services.errors import InvalidInput


def _read_password() -> str:
    password = os.environ.get("VKO_USER_PASSWORD")
    if password is None:
        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Repeat password: "):
            sys.exit("error: passwords do not match")
    try:
        validate_new_password(password)
    except InvalidInput as exc:
        sys.exit(f"error: {exc.code}")
    return password


def create_user(email: str, role: RoleCode, password: str, *, full_name: str = "", branch_id: uuid.UUID | None = None) -> uuid.UUID:
    """Creates a staff user with one role (roles are ensured first). Fails if the e-mail exists."""
    email = normalize_email(email)
    with get_sessionmaker()() as session:
        ensure_roles_and_permissions(session)
        if users_repo.get_by_email(session, email) is not None:
            raise ValueError(f"user {email} already exists")
        role_row = roles_repo.get_role(session, role.value)
        user = User(email=email, password_hash=hash_password(password), full_name=full_name, branch_id=branch_id)
        user.roles = [role_row]
        session.add(user)
        session.commit()
        return user.id


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("ensure-roles", help="create the 7 system roles and the permission catalog")
    create = commands.add_parser("create-user", help="create a staff user")
    create.add_argument("--email", required=True)
    create.add_argument("--role", required=True, choices=[r.value for r in RoleCode])
    create.add_argument("--full-name", default="")
    create.add_argument("--branch-id", type=uuid.UUID)
    args = parser.parse_args(argv)

    if args.command == "ensure-roles":
        with get_sessionmaker()() as session:
            ensure_roles_and_permissions(session)
            session.commit()
        print("roles and permissions are up to date")
    elif args.command == "create-user":
        try:
            user_id = create_user(
                args.email, RoleCode(args.role), _read_password(), full_name=args.full_name, branch_id=args.branch_id
            )
        except ValueError as exc:
            sys.exit(f"error: {exc}")
        print(f"created user {user_id}")


if __name__ == "__main__":
    main()
