-- CreateEnum
CREATE TYPE "CommentStateType" AS ENUM ('public', 'private', 'friend');

-- CreateEnum
CREATE TYPE "MemberLanguageType" AS ENUM ('zh', 'en', 'vi', 'id', 'th');

-- CreateEnum
CREATE TYPE "ReactionEmotionType" AS ENUM ('happy', 'angry', 'surprise', 'sad');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "passwordUpdatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "loginFailedAttempts" INTEGER DEFAULT 0,
    "accountLockedUntil" TIMESTAMP(3),
    "lastFailedLoginAt" TIMESTAMP(3),
    "passwordHistory" JSONB,
    "passwordResetToken" TEXT,
    "passwordResetIssuedAt" TIMESTAMP(3),
    "passwordResetRedeemedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "member" INTEGER,
    "content" TEXT NOT NULL DEFAULT '',
    "content_zh" TEXT NOT NULL DEFAULT '',
    "content_en" TEXT NOT NULL DEFAULT '',
    "content_vi" TEXT NOT NULL DEFAULT '',
    "content_id" TEXT NOT NULL DEFAULT '',
    "content_th" TEXT NOT NULL DEFAULT '',
    "post" INTEGER,
    "parent" INTEGER,
    "root" INTEGER,
    "state" "CommentStateType" DEFAULT 'public',
    "published_date" TIMESTAMP(3),
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "firebaseId" TEXT NOT NULL DEFAULT '',
    "customId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "nickname" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "intro" TEXT NOT NULL DEFAULT '',
    "avatar_image" INTEGER,
    "email" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "language" "MemberLanguageType" DEFAULT 'zh',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content_zh" TEXT NOT NULL DEFAULT '',
    "content_en" TEXT NOT NULL DEFAULT '',
    "content_vi" TEXT NOT NULL DEFAULT '',
    "content_id" TEXT NOT NULL DEFAULT '',
    "content_th" TEXT NOT NULL DEFAULT '',
    "author" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" SERIAL NOT NULL,
    "member" INTEGER,
    "post" INTEGER,
    "comment" INTEGER,
    "emotion" "ReactionEmotionType" NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "file_id" TEXT,
    "file_filesize" INTEGER,
    "file_width" INTEGER,
    "file_height" INTEGER,
    "file_extension" TEXT,
    "urlOriginal" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Member_following_category" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_Comment_like" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_Member_follower" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_Member_block" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_createdBy_idx" ON "Category"("createdBy");

-- CreateIndex
CREATE INDEX "Category_updatedBy_idx" ON "Category"("updatedBy");

-- CreateIndex
CREATE INDEX "Comment_member_idx" ON "Comment"("member");

-- CreateIndex
CREATE INDEX "Comment_post_idx" ON "Comment"("post");

-- CreateIndex
CREATE INDEX "Comment_parent_idx" ON "Comment"("parent");

-- CreateIndex
CREATE INDEX "Comment_root_idx" ON "Comment"("root");

-- CreateIndex
CREATE INDEX "Comment_createdBy_idx" ON "Comment"("createdBy");

-- CreateIndex
CREATE INDEX "Comment_updatedBy_idx" ON "Comment"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_createdBy_idx" ON "Tag"("createdBy");

-- CreateIndex
CREATE INDEX "Tag_updatedBy_idx" ON "Tag"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Member_firebaseId_key" ON "Member"("firebaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_customId_key" ON "Member"("customId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_avatar_image_idx" ON "Member"("avatar_image");

-- CreateIndex
CREATE INDEX "Member_createdBy_idx" ON "Member"("createdBy");

-- CreateIndex
CREATE INDEX "Member_updatedBy_idx" ON "Member"("updatedBy");

-- CreateIndex
CREATE INDEX "Post_author_idx" ON "Post"("author");

-- CreateIndex
CREATE INDEX "Post_createdBy_idx" ON "Post"("createdBy");

-- CreateIndex
CREATE INDEX "Post_updatedBy_idx" ON "Post"("updatedBy");

-- CreateIndex
CREATE INDEX "Reaction_member_idx" ON "Reaction"("member");

-- CreateIndex
CREATE INDEX "Reaction_post_idx" ON "Reaction"("post");

-- CreateIndex
CREATE INDEX "Reaction_comment_idx" ON "Reaction"("comment");

-- CreateIndex
CREATE INDEX "Reaction_createdBy_idx" ON "Reaction"("createdBy");

-- CreateIndex
CREATE INDEX "Reaction_updatedBy_idx" ON "Reaction"("updatedBy");

-- CreateIndex
CREATE INDEX "Image_createdBy_idx" ON "Image"("createdBy");

-- CreateIndex
CREATE INDEX "Image_updatedBy_idx" ON "Image"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "_Member_following_category_AB_unique" ON "_Member_following_category"("A", "B");

-- CreateIndex
CREATE INDEX "_Member_following_category_B_index" ON "_Member_following_category"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Comment_like_AB_unique" ON "_Comment_like"("A", "B");

-- CreateIndex
CREATE INDEX "_Comment_like_B_index" ON "_Comment_like"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Member_follower_AB_unique" ON "_Member_follower"("A", "B");

-- CreateIndex
CREATE INDEX "_Member_follower_B_index" ON "_Member_follower"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Member_block_AB_unique" ON "_Member_block"("A", "B");

-- CreateIndex
CREATE INDEX "_Member_block_B_index" ON "_Member_block"("B");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_member_fkey" FOREIGN KEY ("member") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parent_fkey" FOREIGN KEY ("parent") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_root_fkey" FOREIGN KEY ("root") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_avatar_image_fkey" FOREIGN KEY ("avatar_image") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_author_fkey" FOREIGN KEY ("author") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_member_fkey" FOREIGN KEY ("member") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_comment_fkey" FOREIGN KEY ("comment") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Member_following_category" ADD CONSTRAINT "_Member_following_category_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Member_following_category" ADD CONSTRAINT "_Member_following_category_B_fkey" FOREIGN KEY ("B") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Comment_like" ADD CONSTRAINT "_Comment_like_A_fkey" FOREIGN KEY ("A") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Comment_like" ADD CONSTRAINT "_Comment_like_B_fkey" FOREIGN KEY ("B") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Member_follower" ADD CONSTRAINT "_Member_follower_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Member_follower" ADD CONSTRAINT "_Member_follower_B_fkey" FOREIGN KEY ("B") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Member_block" ADD CONSTRAINT "_Member_block_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Member_block" ADD CONSTRAINT "_Member_block_B_fkey" FOREIGN KEY ("B") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
