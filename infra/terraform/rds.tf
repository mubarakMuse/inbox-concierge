resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet"
  }
}

resource "aws_db_subnet_group" "public" {
  count      = var.db_publicly_accessible ? 1 : 0
  name       = "${var.project_name}-db-public"
  subnet_ids = aws_subnet.public[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-public"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-pg"

  engine         = "postgres"
  engine_version = "16"

  instance_class        = var.db_instance_class
  allocated_storage     = 20
  max_allocated_storage = 50
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = var.db_publicly_accessible ? aws_db_subnet_group.public[0].name : aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = var.db_publicly_accessible
  apply_immediately      = var.db_publicly_accessible
  multi_az               = false

  backup_retention_period = 7
  skip_final_snapshot     = true
  deletion_protection     = false

  tags = {
    Name = "${var.project_name}-rds"
  }
}

locals {
  # Do not set sslmode=require — pg@8.22+ maps it to verify-full and breaks RDS.
  # App sets ssl via DATABASE_SSL=true + rejectUnauthorized:false in db.js.
  database_url = "postgresql://${var.db_username}:${urlencode(var.db_password)}@${aws_db_instance.main.address}:5432/${var.db_name}"
}
