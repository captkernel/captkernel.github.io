$(function(){
	
	
	/* ***************************************************
	// hero 
	*************************************************** */

	var $hero = $('.hero')
	var $herodot = $('.herodot', $hero);
	
	if($hero.length > 0){
		hero__init();
		hero__resize();
	}
	
	function hero__init(){
		$(window).bind("debouncedresize", hero__resize);
		$hero.addClass('hero--ready')
	} // hero__init()
	
	function hero__resize(){
		var w_width = $(window).width();
		var w_height = $(window).height();
		var w_heightsize = w_height - ($('.siteheader__bd').outerHeight() * 1.75)
		var size = (w_width > w_height) ? w_heightsize : 'auto';
		$hero.css({
			"width": size
		});
	}// hero__resize();
	
	/* ***************************************************
	// heroslides 
	*************************************************** */
	
	var $heroslides	= $('.heroslides');
	var $hero	= $('.hero');
	
	heroslides__init();
	
	function heroslides__init(){
		
		$heroslides
			.cycle({
				timeout: 5000,
				speed: 300,
				fx: 'fade',
				fit: 0,
				slideResize: 0,
				before: function (currSlide, nextSlide) {
					var $nextSlide = $(nextSlide);
					var $currSlide = $(currSlide);
/*					$currSlide.removeClass('heroslide--current');
					$nextSlide.addClass('heroslide--current'); */
				},
				after: function (prevSlide, currSlide) {
					var $prevSlide = $(prevSlide);
					var $currSlide = $(currSlide);
					$prevSlide.removeClass('heroslide--current');
					$currSlide.addClass('heroslide--current'); 
				}
			});
		

		// 
		var sharingwaypoints = $hero.waypoint({
			handler: function(direction) {
				if(direction === "down"){
					$('body').addClass('body--scrolled');
				}else{
					$('body').removeClass('body--scrolled');
				}
			}, 
			offset: "-150px"
		});

	} // heroslide__init()
	
	
	
	
	
});