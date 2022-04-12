var gulp        = require('gulp');
var sass = require('gulp-sass') (require('sass')); 
var browserSync = require('browser-sync').create();
var reload      = browserSync.reload;

//// TypeScript compilation 
let ts = require('gulp-typescript'); 
let tsProject = ts.createProject("tsconfig.json"); 

//// Compiling SCSS files
gulp.task('sass', function()
{
    return gulp.src('./*.scss')
                .pipe(sass())
                .pipe(gulp.dest('./'))
                ; 
}); 

gulp.task('Compile_TypeScript', function()
{
    return tsProject.src()
        .pipe(tsProject()).js
        .pipe(gulp.dest('./')); 
               
}); 

// Save a reference to the `reload` method

// Watch scss AND html files, doing different things with each.
gulp.task("default", function(done)
{
     // Serve files from the root of this project
     browserSync.init({
        server: {
            baseDir: "./"
        }
    });

    gulp.watch("*.scss", gulp.series(['sass'])).on("change", reload);
    gulp.watch("*.html").on("change", reload);
    gulp.watch("*.css").on("change", reload);
    gulp.watch("*.js").on("change", reload);
    gulp.watch("*.ts", gulp.series(['Compile_TypeScript'])).on("change", reload);
});