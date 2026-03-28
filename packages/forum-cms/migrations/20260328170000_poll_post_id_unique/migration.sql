-- 一篇文章最多一個投票活動（與 Post.poll / Poll.post 雙向一對一一致）
CREATE UNIQUE INDEX "Poll_post_key" ON "Poll"("post");
