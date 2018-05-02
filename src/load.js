$(document).ready(function() {
  $('#tab-content').load('index.html');

  $('ul#myTab li a').click(function(){
    var activeTab = $(this).attr('href');
      $('#content').load('src/' + activeTab + '.html');
      return false;
  });
});



// $( document ).ready(function() {
//   $(function() {
//     $('a[data-toggle="tab"]').on('click', function(e) {
//         localStorage.setItem('activeTab', $(e.target).attr('href'));
//           // window.location.load(true);
//           window.location.reload(true);
//     });
//     var activeTab = localStorage.getItem('activeTab');
//     if (activeTab) {
//         $('#myTab a[href="' + activeTab + '"]').tab('show').load();
//         localStorage.removeItem('activeTab');
//         dispatchEvent(new Event('resize'));
//     }
//  });
// });
