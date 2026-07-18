-- CreateEnum
CREATE TYPE "StateEnum" AS ENUM ('OPEN', 'LOCKED', 'RESOLVING', 'DISPUTED', 'SETTLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publicKey" VARCHAR(44) NOT NULL,
    "nonce" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(32) NOT NULL,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pdaAddress" VARCHAR(44) NOT NULL,
    "creatorId" UUID NOT NULL,
    "metadata" JSONB NOT NULL,
    "status" "StateEnum" NOT NULL DEFAULT 'OPEN',
    "resolutionDate" TIMESTAMPTZ(6) NOT NULL,
    "targetWallet" VARCHAR(44),

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "marketId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_publicKey_key" ON "User"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_publicKey_idx" ON "User"("publicKey");

-- CreateIndex
CREATE INDEX "User_reputationScore_idx" ON "User"("reputationScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Market_pdaAddress_key" ON "Market"("pdaAddress");

-- CreateIndex
CREATE INDEX "Market_status_resolutionDate_idx" ON "Market"("status", "resolutionDate");

-- CreateIndex
CREATE INDEX "Market_creatorId_idx" ON "Market"("creatorId");

-- CreateIndex
CREATE INDEX "Comment_marketId_createdAt_idx" ON "Comment"("marketId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
