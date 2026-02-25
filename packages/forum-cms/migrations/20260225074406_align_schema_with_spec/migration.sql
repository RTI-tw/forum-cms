-- CreateEnum
CREATE TYPE "MemberStatusType" AS ENUM ('active', 'banned');

-- CreateEnum
CREATE TYPE "PostLanguageType" AS ENUM ('zh', 'en', 'vi', 'id', 'th');

-- CreateEnum
CREATE TYPE "PostStatusType" AS ENUM ('published', 'draft', 'archived', 'hidden');

-- CreateEnum
CREATE TYPE "TopicLanguageType" AS ENUM ('zh', 'en', 'vi', 'id', 'th');

-- CreateEnum
CREATE TYPE "CommentLanguageType" AS ENUM ('zh', 'en', 'vi', 'id', 'th');

-- CreateEnum
CREATE TYPE "CommentStatusType" AS ENUM ('published', 'hidden');

-- CreateEnum
CREATE TYPE "ReactionTypeType" AS ENUM ('love', 'like', 'haha', 'sad', 'angry', 'scared', 'wow');

-- CreateEnum
CREATE TYPE "ContentLanguageType" AS ENUM ('zh', 'en', 'vi', 'id', 'th');

-- CreateEnum
CREATE TYPE "ReportStatusType" AS ENUM ('pending', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "OfficialMapping" (
    "id" SERIAL NOT NULL,
    "cmsUser" INTEGER,
    "officialMember" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "OfficialMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "language" "TopicLanguageType",
    "name_zh" TEXT NOT NULL DEFAULT '',
    "name_en" TEXT NOT NULL DEFAULT '',
    "name_vi" TEXT NOT NULL DEFAULT '',
    "name_id" TEXT NOT NULL DEFAULT '',
    "name_th" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorChoice" (
    "id" SERIAL NOT NULL,
    "post" INTEGER,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "EditorChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifeGuide" (
    "id" SERIAL NOT NULL,
    "post" INTEGER,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "LifeGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" SERIAL NOT NULL,
    "post" INTEGER,
    "member" INTEGER,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "title_zh" TEXT NOT NULL DEFAULT '',
    "title_en" TEXT NOT NULL DEFAULT '',
    "title_vi" TEXT NOT NULL DEFAULT '',
    "title_id" TEXT NOT NULL DEFAULT '',
    "title_th" TEXT NOT NULL DEFAULT '',
    "post" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "totalVotes" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "text_zh" TEXT NOT NULL DEFAULT '',
    "text_en" TEXT NOT NULL DEFAULT '',
    "text_vi" TEXT NOT NULL DEFAULT '',
    "text_id" TEXT NOT NULL DEFAULT '',
    "text_th" TEXT NOT NULL DEFAULT '',
    "poll" INTEGER,
    "voteCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" SERIAL NOT NULL,
    "poll" INTEGER,
    "option" INTEGER,
    "member" INTEGER,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "language" "ContentLanguageType",
    "content_zh" TEXT NOT NULL DEFAULT '',
    "content_en" TEXT NOT NULL DEFAULT '',
    "content_vi" TEXT NOT NULL DEFAULT '',
    "content_id" TEXT NOT NULL DEFAULT '',
    "content_th" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "post" INTEGER,
    "comment" INTEGER,
    "reporter" INTEGER,
    "ip" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "ReportStatusType" DEFAULT 'pending',
    "adminNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForbiddenKeyword" (
    "id" SERIAL NOT NULL,
    "word" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "ForbiddenKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Member - add new columns
ALTER TABLE "Member" ADD COLUMN "isOfficial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "status" "MemberStatusType" DEFAULT 'active';
ALTER TABLE "Member" ADD COLUMN "joinDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Post - add new columns, drop is_active
ALTER TABLE "Post" ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Post" ADD COLUMN "language" "PostLanguageType";
ALTER TABLE "Post" ADD COLUMN "ip" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Post" ADD COLUMN "topic" INTEGER;
ALTER TABLE "Post" ADD COLUMN "status" "PostStatusType" DEFAULT 'draft';
ALTER TABLE "Post" ADD COLUMN "heroImage" INTEGER;
ALTER TABLE "Post" DROP COLUMN "is_active";

-- AlterTable: Comment - add new columns, drop state
ALTER TABLE "Comment" ADD COLUMN "language" "CommentLanguageType";
ALTER TABLE "Comment" ADD COLUMN "ip" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Comment" ADD COLUMN "status" "CommentStatusType" DEFAULT 'published';
ALTER TABLE "Comment" DROP COLUMN "state";

-- AlterTable: Reaction - replace emotion with type
ALTER TABLE "Reaction" DROP COLUMN "emotion";
ALTER TABLE "Reaction" ADD COLUMN "type" "ReactionTypeType" NOT NULL DEFAULT 'like';
ALTER TABLE "Reaction" ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable: Image - add new columns
ALTER TABLE "Image" ADD COLUMN "altText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Image" ADD COLUMN "caption" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Image" ADD COLUMN "width" INTEGER;
ALTER TABLE "Image" ADD COLUMN "height" INTEGER;
ALTER TABLE "Image" ADD COLUMN "uploadedBy" INTEGER;

-- CreateIndex
CREATE INDEX "OfficialMapping_cmsUser_idx" ON "OfficialMapping"("cmsUser");
CREATE INDEX "OfficialMapping_officialMember_idx" ON "OfficialMapping"("officialMember");
CREATE INDEX "OfficialMapping_createdBy_idx" ON "OfficialMapping"("createdBy");
CREATE INDEX "OfficialMapping_updatedBy_idx" ON "OfficialMapping"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");
CREATE INDEX "Topic_createdBy_idx" ON "Topic"("createdBy");
CREATE INDEX "Topic_updatedBy_idx" ON "Topic"("updatedBy");

-- CreateIndex
CREATE INDEX "EditorChoice_post_idx" ON "EditorChoice"("post");
CREATE INDEX "EditorChoice_createdBy_idx" ON "EditorChoice"("createdBy");
CREATE INDEX "EditorChoice_updatedBy_idx" ON "EditorChoice"("updatedBy");

-- CreateIndex
CREATE INDEX "LifeGuide_post_idx" ON "LifeGuide"("post");
CREATE INDEX "LifeGuide_createdBy_idx" ON "LifeGuide"("createdBy");
CREATE INDEX "LifeGuide_updatedBy_idx" ON "LifeGuide"("updatedBy");

-- CreateIndex
CREATE INDEX "Bookmark_post_idx" ON "Bookmark"("post");
CREATE INDEX "Bookmark_member_idx" ON "Bookmark"("member");
CREATE INDEX "Bookmark_createdBy_idx" ON "Bookmark"("createdBy");
CREATE INDEX "Bookmark_updatedBy_idx" ON "Bookmark"("updatedBy");

-- CreateIndex
CREATE INDEX "Poll_post_idx" ON "Poll"("post");
CREATE INDEX "Poll_createdBy_idx" ON "Poll"("createdBy");
CREATE INDEX "Poll_updatedBy_idx" ON "Poll"("updatedBy");

-- CreateIndex
CREATE INDEX "PollOption_poll_idx" ON "PollOption"("poll");
CREATE INDEX "PollOption_createdBy_idx" ON "PollOption"("createdBy");
CREATE INDEX "PollOption_updatedBy_idx" ON "PollOption"("updatedBy");

-- CreateIndex
CREATE INDEX "PollVote_poll_idx" ON "PollVote"("poll");
CREATE INDEX "PollVote_option_idx" ON "PollVote"("option");
CREATE INDEX "PollVote_member_idx" ON "PollVote"("member");
CREATE INDEX "PollVote_createdBy_idx" ON "PollVote"("createdBy");
CREATE INDEX "PollVote_updatedBy_idx" ON "PollVote"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Content_identifier_key" ON "Content"("identifier");
CREATE INDEX "Content_createdBy_idx" ON "Content"("createdBy");
CREATE INDEX "Content_updatedBy_idx" ON "Content"("updatedBy");

-- CreateIndex
CREATE INDEX "Report_post_idx" ON "Report"("post");
CREATE INDEX "Report_comment_idx" ON "Report"("comment");
CREATE INDEX "Report_reporter_idx" ON "Report"("reporter");
CREATE INDEX "Report_createdBy_idx" ON "Report"("createdBy");
CREATE INDEX "Report_updatedBy_idx" ON "Report"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ForbiddenKeyword_word_key" ON "ForbiddenKeyword"("word");
CREATE INDEX "ForbiddenKeyword_createdBy_idx" ON "ForbiddenKeyword"("createdBy");
CREATE INDEX "ForbiddenKeyword_updatedBy_idx" ON "ForbiddenKeyword"("updatedBy");

-- CreateIndex
CREATE INDEX "Video_createdBy_idx" ON "Video"("createdBy");
CREATE INDEX "Video_updatedBy_idx" ON "Video"("updatedBy");

-- CreateIndex for altered tables
CREATE INDEX "Post_topic_idx" ON "Post"("topic");
CREATE INDEX "Post_heroImage_idx" ON "Post"("heroImage");
CREATE INDEX "Image_uploadedBy_idx" ON "Image"("uploadedBy");

-- AddForeignKey: OfficialMapping
ALTER TABLE "OfficialMapping" ADD CONSTRAINT "OfficialMapping_cmsUser_fkey" FOREIGN KEY ("cmsUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfficialMapping" ADD CONSTRAINT "OfficialMapping_officialMember_fkey" FOREIGN KEY ("officialMember") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfficialMapping" ADD CONSTRAINT "OfficialMapping_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfficialMapping" ADD CONSTRAINT "OfficialMapping_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Topic
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: EditorChoice
ALTER TABLE "EditorChoice" ADD CONSTRAINT "EditorChoice_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorChoice" ADD CONSTRAINT "EditorChoice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorChoice" ADD CONSTRAINT "EditorChoice_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: LifeGuide
ALTER TABLE "LifeGuide" ADD CONSTRAINT "LifeGuide_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LifeGuide" ADD CONSTRAINT "LifeGuide_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LifeGuide" ADD CONSTRAINT "LifeGuide_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Bookmark
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_member_fkey" FOREIGN KEY ("member") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Poll
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PollOption
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_poll_fkey" FOREIGN KEY ("poll") REFERENCES "Poll"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PollVote
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_poll_fkey" FOREIGN KEY ("poll") REFERENCES "Poll"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_option_fkey" FOREIGN KEY ("option") REFERENCES "PollOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_member_fkey" FOREIGN KEY ("member") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Content
ALTER TABLE "Content" ADD CONSTRAINT "Content_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Content" ADD CONSTRAINT "Content_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Report
ALTER TABLE "Report" ADD CONSTRAINT "Report_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_comment_fkey" FOREIGN KEY ("comment") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporter_fkey" FOREIGN KEY ("reporter") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ForbiddenKeyword
ALTER TABLE "ForbiddenKeyword" ADD CONSTRAINT "ForbiddenKeyword_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ForbiddenKeyword" ADD CONSTRAINT "ForbiddenKeyword_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Video
ALTER TABLE "Video" ADD CONSTRAINT "Video_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Video" ADD CONSTRAINT "Video_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Post (new relations)
ALTER TABLE "Post" ADD CONSTRAINT "Post_topic_fkey" FOREIGN KEY ("topic") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_heroImage_fkey" FOREIGN KEY ("heroImage") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Image (new relation)
ALTER TABLE "Image" ADD CONSTRAINT "Image_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropEnum (cleanup old enums)
DROP TYPE "CommentStateType";
DROP TYPE "ReactionEmotionType";
